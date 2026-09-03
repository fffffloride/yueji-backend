import { createHash, randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";

import { OrderGiftPageQueryDto } from "./dto/order-gift.dto";
import { BizOrderGift } from "./entities/order-gift.entity";
import { BizOrderItem } from "./entities/order-item.entity";
import { BizOrder } from "./entities/order.entity";
import {
  ORDER_GIFT_STATUS_LABEL,
  OrderGiftDirection,
  type OrderGiftDirectionValue,
  OrderGiftStatus,
  OrderViewerRole,
} from "./order-gift-status";
import { OrderStatus } from "./order-status";
import { saveOrderWithFreshVerifyCode } from "./order-verify-code";
import { ACTIVE_ORDER_APPOINTMENT_STATUSES } from "@/appointment/appointment.constants";
import { Appointment } from "@/appointment/entities/appointment.entity";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { BusinessException } from "@/common/exceptions/business.exception";
import { GroupBuyMember } from "@/group-buy/entities/group-buy-member.entity";
import { Member } from "@/member/entities/member.entity";
import { Refund } from "@/payment/entities/refund.entity";
import { RefundStatus } from "@/payment/payment-status";

const GIFT_VALID_MS = 7 * 24 * 60 * 60 * 1000;

export interface OrderViewerCapabilities {
  viewerRole: (typeof OrderViewerRole)[keyof typeof OrderViewerRole];
  giftId: string | null;
  canGift: boolean;
  canReturnGift: boolean;
  canBookAppointment: boolean;
}

export interface OrderGiftItemVo {
  id: string;
  productId: string;
  skuId: string;
  productName: string;
  productImage: string | null;
  skuName: string | null;
  quantity: number;
}

@Injectable()
export class OrderGiftService {
  constructor(private readonly dataSource: DataSource) {}

  async create(memberId: string, orderId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      await this.expirePending(manager, order.id);
      await this.assertTransferable(manager, order, memberId);

      const pending = await manager.findOne(BizOrderGift, {
        where: { orderId: order.id, status: OrderGiftStatus.PENDING, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (pending) throw this.userError("该订单已有待领取赠礼，请先撤回后重新生成");

      const token = randomBytes(32).toString("base64url");
      const gift = await manager.save(
        manager.create(BizOrderGift, {
          orderId: order.id,
          senderMemberId: memberId,
          recipientMemberId: null,
          tokenHash: this.hashToken(token),
          status: OrderGiftStatus.PENDING,
          expiresAt: new Date(Date.now() + GIFT_VALID_MS),
          claimedAt: null,
          revokedAt: null,
          returnedAt: null,
          isDeleted: 0,
        })
      );
      return { gift, token };
    });

    const [record] = await this.hydrate([result.gift], memberId, OrderGiftDirection.SENT);
    return { ...record, token: result.token };
  }

  async preview(token: string) {
    const gift = await this.findByToken(token);
    if (gift.status === OrderGiftStatus.PENDING && gift.expiresAt <= new Date()) {
      await this.markExpired(gift.id);
      throw this.invalidGiftError();
    }
    if (gift.status !== OrderGiftStatus.PENDING) throw this.invalidGiftError();

    const manager = this.dataSource.manager;
    const order = await manager.findOne(BizOrder, { where: { id: gift.orderId, isDeleted: 0 } });
    if (!order || !(await this.isAvailable(manager, order, gift.senderMemberId))) {
      throw this.invalidGiftError();
    }

    const [sender, items] = await Promise.all([
      manager.findOne(Member, { where: { id: gift.senderMemberId, isDeleted: 0 } }),
      this.safeItems(manager, gift.orderId),
    ]);
    return {
      id: String(gift.id),
      status: gift.status,
      statusLabel: ORDER_GIFT_STATUS_LABEL[gift.status],
      senderNickname: sender?.nickname ?? "",
      senderAvatar: sender?.avatar ?? null,
      expiresAt: gift.expiresAt,
      items,
      canClaim: true,
    };
  }

  async claim(memberId: string, token: string) {
    const candidate = await this.findByToken(token);
    const gift = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, candidate.orderId);
      const current = await manager.findOne(BizOrderGift, {
        where: { id: candidate.id, tokenHash: candidate.tokenHash, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!current) throw this.invalidGiftError();
      if (current.status === OrderGiftStatus.CLAIMED) {
        if (String(current.recipientMemberId) === String(memberId)) return current;
        throw this.invalidGiftError();
      }
      if (current.status !== OrderGiftStatus.PENDING) throw this.invalidGiftError();
      if (current.expiresAt <= new Date()) {
        current.status = OrderGiftStatus.EXPIRED;
        await manager.save(current);
        return null;
      }
      if (String(current.senderMemberId) === String(memberId)) {
        throw this.userError("不能领取自己赠送的订单");
      }
      if (!(await this.isAvailable(manager, order, current.senderMemberId))) {
        throw this.invalidGiftError();
      }

      order.beneficiaryMemberId = memberId;
      current.recipientMemberId = memberId;
      current.status = OrderGiftStatus.CLAIMED;
      current.claimedAt = new Date();
      await manager.save(current);
      await saveOrderWithFreshVerifyCode(manager, order);
      return current;
    });
    if (!gift) throw this.invalidGiftError();

    const [record] = await this.hydrate([gift], memberId, OrderGiftDirection.RECEIVED);
    return record;
  }

  async revoke(memberId: string, id: string) {
    const candidate = await this.findOwnedGift(id, memberId, OrderGiftDirection.SENT);
    const gift = await this.dataSource.transaction(async (manager) => {
      await this.lockOrder(manager, candidate.orderId);
      const current = await this.lockGift(manager, candidate.id);
      if (String(current.senderMemberId) !== String(memberId)) throw this.notFoundError();
      if (current.status === OrderGiftStatus.REVOKED) return current;
      if (current.status !== OrderGiftStatus.PENDING) {
        throw this.userError("当前赠礼状态不可撤回");
      }
      if (current.expiresAt <= new Date()) {
        current.status = OrderGiftStatus.EXPIRED;
      } else {
        current.status = OrderGiftStatus.REVOKED;
        current.revokedAt = new Date();
      }
      return manager.save(current);
    });
    const [record] = await this.hydrate([gift], memberId, OrderGiftDirection.SENT);
    return record;
  }

  async returnGift(memberId: string, id: string) {
    const candidate = await this.findOwnedGift(id, memberId, OrderGiftDirection.RECEIVED);
    const gift = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, candidate.orderId);
      const current = await this.lockGift(manager, candidate.id);
      if (String(current.recipientMemberId) !== String(memberId)) throw this.notFoundError();
      if (current.status === OrderGiftStatus.RETURNED) return current;
      if (current.status !== OrderGiftStatus.CLAIMED) {
        throw this.userError("当前赠礼状态不可退回");
      }
      if (
        order.status !== OrderStatus.PAID ||
        String(this.beneficiaryId(order)) !== String(memberId)
      ) {
        throw this.userError("当前订单不可退回");
      }
      if (await this.hasActiveAppointment(manager, order.id)) {
        throw this.userError("订单已有预约，请先取消预约");
      }
      if (await this.hasProcessingRefund(manager, order.id)) {
        throw this.userError("订单正在退款，暂不可退回");
      }

      order.beneficiaryMemberId = current.senderMemberId;
      current.status = OrderGiftStatus.RETURNED;
      current.returnedAt = new Date();
      await manager.save(current);
      await saveOrderWithFreshVerifyCode(manager, order);
      return current;
    });

    const [record] = await this.hydrate([gift], memberId, OrderGiftDirection.RECEIVED);
    return record;
  }

  async page(memberId: string, query: OrderGiftPageQueryDto) {
    await this.expireMemberPending(memberId);
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.dataSource
      .getRepository(BizOrderGift)
      .createQueryBuilder("gift")
      .where("gift.isDeleted = 0");
    if (query.direction === OrderGiftDirection.SENT) {
      qb.andWhere("gift.senderMemberId = :memberId", { memberId });
    } else {
      qb.andWhere("gift.recipientMemberId = :memberId", { memberId });
    }
    const [list, total] = await qb
      .orderBy("gift.createTime", "DESC")
      .addOrderBy("gift.id", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      data: await this.hydrate(list, memberId, query.direction),
      page: { pageNum, pageSize, total },
    };
  }

  async getOrderCapabilities(
    memberId: string,
    orders: BizOrder[],
    appointmentMap: Map<string, { id: string; status: number }>
  ): Promise<Map<string, OrderViewerCapabilities>> {
    const orderIds = orders.map((order) => String(order.id));
    if (!orderIds.length) return new Map();
    const manager = this.dataSource.manager;
    const [groups, refunds, gifts] = await Promise.all([
      manager.find(GroupBuyMember, { where: { orderId: In(orderIds), isDeleted: 0 } }),
      manager.find(Refund, {
        where: { orderId: In(orderIds), status: RefundStatus.PROCESSING, isDeleted: 0 },
      }),
      manager.find(BizOrderGift, {
        where: {
          orderId: In(orderIds),
          status: In([OrderGiftStatus.PENDING, OrderGiftStatus.CLAIMED]),
          isDeleted: 0,
        },
        order: { id: "DESC" },
      }),
    ]);
    const groupIds = new Set(groups.map((row) => String(row.orderId)));
    const refundIds = new Set(refunds.map((row) => String(row.orderId)));
    const giftMap = new Map<string, BizOrderGift>();
    const now = new Date();
    for (const gift of gifts) {
      if (gift.status === OrderGiftStatus.PENDING && gift.expiresAt <= now) continue;
      const key = String(gift.orderId);
      if (!giftMap.has(key)) giftMap.set(key, gift);
    }

    return new Map(
      orders.map((order) => {
        const id = String(order.id);
        const beneficiaryId = this.beneficiaryId(order);
        const purchaser = String(order.memberId) === String(memberId);
        const beneficiary = String(beneficiaryId) === String(memberId);
        const activeGift = giftMap.get(id);
        const blocked = appointmentMap.has(id) || refundIds.has(id);
        return [
          id,
          {
            viewerRole: purchaser ? OrderViewerRole.PURCHASER : OrderViewerRole.BENEFICIARY,
            giftId: activeGift?.id ? String(activeGift.id) : null,
            canGift:
              purchaser &&
              beneficiary &&
              order.status === OrderStatus.PAID &&
              !blocked &&
              !groupIds.has(id) &&
              !activeGift,
            canReturnGift:
              !purchaser &&
              beneficiary &&
              order.status === OrderStatus.PAID &&
              !blocked &&
              activeGift?.status === OrderGiftStatus.CLAIMED &&
              String(activeGift.recipientMemberId) === String(memberId),
            canBookAppointment: beneficiary && order.status === OrderStatus.PAID && !blocked,
          },
        ];
      })
    );
  }

  assertRefundAllowed(order: BizOrder): void {
    if (String(this.beneficiaryId(order)) !== String(order.memberId)) {
      throw this.userError("订单已转赠，请由受赠人退回后再退款");
    }
  }

  async revokePendingForRefund(manager: EntityManager, orderId: string): Promise<void> {
    const now = new Date();
    await manager
      .createQueryBuilder()
      .update(BizOrderGift)
      .set({ status: OrderGiftStatus.REVOKED, revokedAt: now, updateTime: now })
      .where("order_id = :orderId", { orderId })
      .andWhere("status = :status", { status: OrderGiftStatus.PENDING })
      .andWhere("is_deleted = 0")
      .execute();
  }

  private async hydrate(
    gifts: BizOrderGift[],
    memberId: string,
    direction: OrderGiftDirectionValue
  ) {
    if (!gifts.length) return [];
    const manager = this.dataSource.manager;
    const orderIds = [...new Set(gifts.map((gift) => String(gift.orderId)))];
    const memberIds = [
      ...new Set(
        gifts.flatMap((gift) =>
          [gift.senderMemberId, gift.recipientMemberId].filter((id): id is string => Boolean(id))
        )
      ),
    ];
    const [orders, items, members, appointments, refunds] = await Promise.all([
      manager.find(BizOrder, { where: { id: In(orderIds), isDeleted: 0 } }),
      manager.find(BizOrderItem, {
        where: { orderId: In(orderIds), isDeleted: 0 },
        order: { id: "ASC" },
      }),
      manager.find(Member, { where: { id: In(memberIds), isDeleted: 0 } }),
      manager.find(Appointment, {
        where: {
          orderId: In(orderIds),
          status: In(ACTIVE_ORDER_APPOINTMENT_STATUSES),
          isDeleted: 0,
        },
      }),
      manager.find(Refund, {
        where: { orderId: In(orderIds), status: RefundStatus.PROCESSING, isDeleted: 0 },
      }),
    ]);
    const orderMap = new Map(orders.map((order) => [String(order.id), order]));
    const memberMap = new Map(members.map((member) => [String(member.id), member]));
    const appointmentIds = new Set(appointments.map((row) => String(row.orderId)));
    const refundIds = new Set(refunds.map((row) => String(row.orderId)));
    const itemMap = new Map<string, OrderGiftItemVo[]>();
    for (const item of items) {
      const id = String(item.orderId);
      const list = itemMap.get(id) ?? [];
      list.push(this.toSafeItem(item));
      itemMap.set(id, list);
    }

    return gifts.map((gift) => {
      const orderId = String(gift.orderId);
      const order = orderMap.get(orderId);
      const sender = memberMap.get(String(gift.senderMemberId));
      const recipient = gift.recipientMemberId
        ? memberMap.get(String(gift.recipientMemberId))
        : null;
      const currentBeneficiary = order ? this.beneficiaryId(order) : null;
      const blocked = appointmentIds.has(orderId) || refundIds.has(orderId);
      const ownsBenefit = String(currentBeneficiary) === String(memberId);
      return {
        id: String(gift.id),
        orderId,
        status: gift.status,
        statusLabel: ORDER_GIFT_STATUS_LABEL[gift.status],
        direction,
        senderNickname: sender?.nickname ?? "",
        senderAvatar: sender?.avatar ?? null,
        recipientNickname: recipient?.nickname ?? null,
        recipientAvatar: recipient?.avatar ?? null,
        expiresAt: gift.expiresAt,
        claimedAt: gift.claimedAt ?? null,
        revokedAt: gift.revokedAt ?? null,
        returnedAt: gift.returnedAt ?? null,
        items: itemMap.get(orderId) ?? [],
        canRevoke:
          direction === OrderGiftDirection.SENT &&
          String(gift.senderMemberId) === String(memberId) &&
          gift.status === OrderGiftStatus.PENDING &&
          gift.expiresAt > new Date(),
        canReturnGift:
          direction === OrderGiftDirection.RECEIVED &&
          gift.status === OrderGiftStatus.CLAIMED &&
          ownsBenefit &&
          order?.status === OrderStatus.PAID &&
          !blocked,
        canBookAppointment:
          direction === OrderGiftDirection.RECEIVED &&
          gift.status === OrderGiftStatus.CLAIMED &&
          ownsBenefit &&
          order?.status === OrderStatus.PAID &&
          !blocked,
      };
    });
  }

  private async safeItems(manager: EntityManager, orderId: string) {
    const items = await manager.find(BizOrderItem, {
      where: { orderId, isDeleted: 0 },
      order: { id: "ASC" },
    });
    return items.map((item) => this.toSafeItem(item));
  }

  private toSafeItem(item: BizOrderItem) {
    return {
      id: String(item.id),
      productId: String(item.productId),
      skuId: String(item.skuId),
      productName: item.productName,
      productImage: item.productImage ?? null,
      skuName: item.skuName ?? null,
      quantity: item.quantity,
    };
  }

  private async assertTransferable(
    manager: EntityManager,
    order: BizOrder,
    memberId: string
  ): Promise<void> {
    if (
      String(order.memberId) !== String(memberId) ||
      String(this.beneficiaryId(order)) !== String(memberId)
    ) {
      throw this.notFoundError();
    }
    if (order.status !== OrderStatus.PAID) throw this.userError("仅待核销订单可以赠送");
    if (await this.hasActiveAppointment(manager, order.id)) {
      throw this.userError("订单已有预约，不能赠送");
    }
    if (await this.hasProcessingRefund(manager, order.id)) {
      throw this.userError("订单正在退款，不能赠送");
    }
    if (await manager.findOne(GroupBuyMember, { where: { orderId: order.id, isDeleted: 0 } })) {
      throw this.userError("拼团订单暂不支持赠送");
    }
  }

  private async isAvailable(
    manager: EntityManager,
    order: BizOrder,
    senderMemberId: string
  ): Promise<boolean> {
    if (
      order.status !== OrderStatus.PAID ||
      String(order.memberId) !== String(senderMemberId) ||
      String(this.beneficiaryId(order)) !== String(senderMemberId)
    ) {
      return false;
    }
    if (await this.hasActiveAppointment(manager, order.id)) return false;
    if (await this.hasProcessingRefund(manager, order.id)) return false;
    return !(await manager.findOne(GroupBuyMember, {
      where: { orderId: order.id, isDeleted: 0 },
    }));
  }

  private hasActiveAppointment(manager: EntityManager, orderId: string) {
    return manager.findOne(Appointment, {
      where: {
        orderId,
        status: In(ACTIVE_ORDER_APPOINTMENT_STATUSES),
        isDeleted: 0,
      },
    });
  }

  private hasProcessingRefund(manager: EntityManager, orderId: string) {
    return manager.findOne(Refund, {
      where: { orderId, status: RefundStatus.PROCESSING, isDeleted: 0 },
    });
  }

  private async expirePending(manager: EntityManager, orderId: string): Promise<void> {
    const pending = await manager.findOne(BizOrderGift, {
      where: { orderId, status: OrderGiftStatus.PENDING, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!pending || pending.expiresAt > new Date()) return;
    pending.status = OrderGiftStatus.EXPIRED;
    await manager.save(pending);
  }

  private async expireMemberPending(memberId: string): Promise<void> {
    const now = new Date();
    await this.dataSource
      .getRepository(BizOrderGift)
      .createQueryBuilder()
      .update(BizOrderGift)
      .set({ status: OrderGiftStatus.EXPIRED, updateTime: now })
      .where("sender_member_id = :memberId", { memberId })
      .andWhere("status = :status", { status: OrderGiftStatus.PENDING })
      .andWhere("expires_at <= :now", { now })
      .andWhere("is_deleted = 0")
      .execute();
  }

  private async markExpired(id: string): Promise<void> {
    await this.dataSource
      .getRepository(BizOrderGift)
      .update(
        { id, status: OrderGiftStatus.PENDING, isDeleted: 0 },
        { status: OrderGiftStatus.EXPIRED }
      );
  }

  private async findByToken(token: string): Promise<BizOrderGift> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw this.invalidGiftError();
    const gift = await this.dataSource.getRepository(BizOrderGift).findOne({
      where: { tokenHash: this.hashToken(token), isDeleted: 0 },
    });
    if (!gift) throw this.invalidGiftError();
    return gift;
  }

  private async findOwnedGift(
    id: string,
    memberId: string,
    direction: OrderGiftDirectionValue
  ): Promise<BizOrderGift> {
    const repository = this.dataSource.getRepository(BizOrderGift);
    const gift = await repository.findOne({
      where:
        direction === OrderGiftDirection.SENT
          ? { id, senderMemberId: memberId, isDeleted: 0 }
          : { id, recipientMemberId: memberId, isDeleted: 0 },
    });
    if (!gift) throw this.notFoundError();
    return gift;
  }

  private async lockOrder(manager: EntityManager, id: string): Promise<BizOrder> {
    const order = await manager.findOne(BizOrder, {
      where: { id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!order) throw this.notFoundError();
    return order;
  }

  private async lockGift(manager: EntityManager, id: string): Promise<BizOrderGift> {
    const gift = await manager.findOne(BizOrderGift, {
      where: { id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!gift) throw this.notFoundError();
    return gift;
  }

  private beneficiaryId(order: BizOrder): string {
    return order.beneficiaryMemberId ?? order.memberId;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private invalidGiftError(): BusinessException {
    return this.userError("礼物不存在或已失效");
  }

  private notFoundError(): BusinessException {
    return this.userError("赠礼记录不存在");
  }

  private userError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
