import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, LessThan, Repository } from "typeorm";

import { BizOrder } from "./entities/order.entity";
import { BizOrderItem } from "./entities/order-item.entity";
import { OrderCreateDto } from "./dto/order-create.dto";
import { AppOrderQueryDto, OrderQueryDto } from "./dto/order-query.dto";
import { OrderStatus, ORDER_STATUS_LABEL } from "./order-status";
import { assertTransition } from "./order-state";
import { ORDER_EVENTS, type OrderEventPayload } from "./order.events";
import { CartService } from "@/cart/cart.service";
import { ProductService } from "@/product/product.service";
import { Member } from "@/member/entities/member.entity";
import { DomainEvents } from "@/common/events/domain-events";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { OrderBenefitsService } from "@/marketing/order-benefits.service";
import { PointsBizType } from "@/marketing/marketing.constants";

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(BizOrder)
    private readonly orderRepository: Repository<BizOrder>,
    @InjectRepository(BizOrderItem)
    private readonly itemRepository: Repository<BizOrderItem>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly dataSource: DataSource,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly orderBenefits: OrderBenefitsService,
    private readonly domainEvents: DomainEvents,
    private readonly configService: ConfigService
  ) {}

  async create(memberId: string, dto: OrderCreateDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const lines = await this.resolveCreateLines(manager, memberId, dto);
      if (lines.length === 0) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "请选择要结算的商品" });
      }
      lines.sort((a, b) => a.skuId.localeCompare(b.skuId));
      const pricedLines: {
        skuId: string;
        productId: string;
        categoryId: string;
        productName: string;
        productImage: string | null;
        skuName: string;
        price: number;
        quantity: number;
      }[] = [];

      for (const line of lines) {
        const { sku, product } = await this.productService.getSkuForOrder(manager, line.skuId);
        if (sku.stock < line.quantity) {
          throw new BusinessException({
            ...ErrorCode.USER_ERROR,
            msg: `库存不足：${product.name} ${sku.name}`,
          });
        }
        pricedLines.push({
          skuId: sku.id,
          productId: product.id,
          categoryId: product.categoryId,
          productName: product.name,
          productImage: product.mainImage ?? null,
          skuName: sku.name,
          price: sku.price,
          quantity: line.quantity,
        });
      }

      if (dto.cartIds?.length) {
        // SKU 锁之后再锁购物车行；并发结算同一购物车时只有第一个请求可继续。
        await this.cartService.lockOwnedByIds(manager, memberId, dto.cartIds);
      }

      const pricing = await this.orderBenefits.quote(
        manager,
        memberId,
        pricedLines,
        dto.memberCouponId,
        dto.pointsToUse ?? 0,
        true
      );
      const created = manager.create(BizOrder, {
        orderNo: this.nextOrderNo(),
        memberId,
        status: OrderStatus.UNPAID,
        totalAmount: pricing.totalAmount,
        discountAmount: pricing.discountAmount,
        payAmount: pricing.payAmount,
        memberLevelId: pricing.memberLevelId,
        memberDiscount: pricing.memberDiscount,
        memberCouponId: pricing.memberCouponId,
        couponAmount: pricing.couponAmount,
        pointsUsed: pricing.pointsUsed,
        pointsDeduct: pricing.pointsDeduct,
        contactName: dto.contactName ?? null,
        contactMobile: dto.contactMobile ?? null,
        remark: dto.remark ?? null,
        isDeleted: 0,
      });
      await manager.save(created);
      await this.orderBenefits.reserveOrder(manager, created);

      const items = pricedLines.map((line) =>
        manager.create(BizOrderItem, {
          orderId: created.id,
          productId: line.productId,
          skuId: line.skuId,
          productName: line.productName,
          productImage: line.productImage,
          skuName: line.skuName,
          price: line.price,
          quantity: line.quantity,
          subtotal: line.price * line.quantity,
          isDeleted: 0,
        })
      );
      await manager.save(items);

      for (const line of pricedLines) {
        await this.productService.adjustStock(manager, line.skuId, -line.quantity);
      }

      if (dto.cartIds?.length) {
        await this.cartService.removeOwnedByIds(manager, memberId, dto.cartIds);
      }

      const autoPaid = created.payAmount === 0;
      if (autoPaid) await this.markPaid(manager, created, new Date(), 2);
      return { order: created, autoPaid };
    });

    if (result.autoPaid) this.publishPaid(result.order);
    return this.getDetail(result.order.id, memberId);
  }

  async quote(memberId: string, dto: OrderCreateDto) {
    return this.dataSource.transaction(async (manager) => {
      const lines = await this.resolveCreateLines(manager, memberId, dto);
      const pricedLines = [];
      for (const line of lines) {
        const { sku, product } = await this.productService.getSkuForOrder(manager, line.skuId);
        if (sku.stock < line.quantity) {
          throw new BusinessException({
            ...ErrorCode.USER_ERROR,
            msg: `库存不足：${product.name}`,
          });
        }
        pricedLines.push({
          skuId: sku.id,
          productId: product.id,
          categoryId: product.categoryId,
          price: sku.price,
          quantity: line.quantity,
        });
      }
      return this.orderBenefits.quote(
        manager,
        memberId,
        pricedLines,
        dto.memberCouponId,
        dto.pointsToUse ?? 0
      );
    });
  }

  /** 创建一件固定拼团价订单；优惠字段固定为零，由拼团模块在同一事务中调用。 */
  async createGroupBuyOrder(
    manager: EntityManager,
    memberId: string,
    skuId: string,
    groupPrice: number,
    remark: string
  ): Promise<BizOrder> {
    if (groupPrice <= 0) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "拼团价无效" });
    }
    const member = await manager.findOne(Member, {
      where: { id: memberId, status: 1, isDeleted: 0 },
      lock: { mode: "pessimistic_read" },
    });
    if (!member) throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "会员不可用" });

    const { sku, product } = await this.productService.getSkuForOrder(manager, skuId);
    if (sku.stock < 1) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: `库存不足：${product.name}` });
    }

    const order = manager.create(BizOrder, {
      orderNo: this.nextOrderNo(),
      memberId,
      status: OrderStatus.UNPAID,
      totalAmount: groupPrice,
      discountAmount: 0,
      memberLevelId: null,
      memberDiscount: 0,
      memberCouponId: null,
      couponAmount: 0,
      pointsUsed: 0,
      pointsDeduct: 0,
      payAmount: groupPrice,
      remark,
      isDeleted: 0,
    });
    await manager.save(order);
    await manager.save(
      manager.create(BizOrderItem, {
        orderId: order.id,
        productId: product.id,
        skuId: sku.id,
        productName: product.name,
        productImage: product.mainImage ?? null,
        skuName: sku.name,
        price: groupPrice,
        quantity: 1,
        subtotal: groupPrice,
        isDeleted: 0,
      })
    );
    await this.productService.adjustStock(manager, sku.id, -1);
    return order;
  }

  async availableCoupons(memberId: string, dto: OrderCreateDto) {
    return this.dataSource.transaction(async (manager) => {
      const lines = await this.resolveCreateLines(manager, memberId, dto);
      const pricedLines = [];
      for (const line of lines) {
        const { sku, product } = await this.productService.getSkuForOrder(manager, line.skuId);
        pricedLines.push({
          skuId: sku.id,
          productId: product.id,
          categoryId: product.categoryId,
          price: sku.price,
          quantity: line.quantity,
        });
      }
      return this.orderBenefits.availableCoupons(manager, memberId, pricedLines);
    });
  }

  async appPage(memberId: string, query: AppOrderQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.orderRepository
      .createQueryBuilder("o")
      .where("o.isDeleted = 0")
      .andWhere("o.memberId = :memberId", { memberId });
    if (query.status !== undefined) {
      qb.andWhere("o.status = :status", { status: query.status });
    }
    const [list, total] = await qb
      .orderBy("o.createTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const ids = list.map((o) => o.id);
    const items = ids.length
      ? await this.itemRepository.find({ where: { orderId: In(ids), isDeleted: 0 } })
      : [];
    const itemMap = new Map<string, BizOrderItem[]>();
    for (const item of items) {
      const key = String(item.orderId);
      itemMap.set(key, [...(itemMap.get(key) ?? []), item]);
    }

    return {
      data: list.map((o) => ({
        ...this.toListVo(o),
        items: itemMap.get(String(o.id)) ?? [],
      })),
      page: { pageNum, pageSize, total },
    };
  }

  async getDetail(id: string, memberId?: string) {
    const order = await this.orderRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!order) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "订单不存在" });
    }
    if (memberId && String(order.memberId) !== String(memberId)) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "订单不存在" });
    }
    const items = await this.itemRepository.find({
      where: { orderId: id, isDeleted: 0 },
      order: { id: "ASC" },
    });
    const member = await this.memberRepository.findOne({ where: { id: order.memberId } });
    return {
      ...this.toListVo(order),
      contactName: order.contactName,
      contactMobile: order.contactMobile,
      remark: order.remark,
      verifyCode: order.verifyCode,
      verifyTime: order.verifyTime,
      verifyBy: order.verifyBy,
      cancelTime: order.cancelTime,
      cancelReason: order.cancelReason,
      memberNickname: member?.nickname ?? "",
      memberMobile: member?.mobile ?? "",
      items,
      pricing: {
        totalAmount: order.totalAmount,
        memberLevelId: order.memberLevelId,
        memberDiscount: order.memberDiscount,
        memberCouponId: order.memberCouponId,
        couponAmount: order.couponAmount,
        pointsUsed: order.pointsUsed,
        pointsDeduct: order.pointsDeduct,
        discountAmount: order.discountAmount,
        payAmount: order.payAmount,
      },
    };
  }

  async lockForPayment(manager: EntityManager, id: string, memberId?: string): Promise<BizOrder> {
    const order = await this.lockOrder(manager, id);
    if (memberId && String(order.memberId) !== String(memberId)) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "订单不存在" });
    }
    return order;
  }

  async markPaid(
    manager: EntityManager,
    order: BizOrder,
    paidAt: Date,
    payType: number
  ): Promise<BizOrder> {
    this.safeTransition(order.status, OrderStatus.PAID);
    order.status = OrderStatus.PAID;
    order.payType = payType;
    order.payTime = paidAt;
    order.verifyCode = await this.nextVerifyCode(manager);
    await manager.save(order);

    const items = await manager.find(BizOrderItem, {
      where: { orderId: order.id, isDeleted: 0 },
    });
    const salesByProduct = new Map<string, number>();
    for (const item of items) {
      salesByProduct.set(item.productId, (salesByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [productId, qty] of salesByProduct) {
      await this.productService.increaseSales(manager, productId, qty);
    }
    await this.orderBenefits.markPaid(manager, order);
    return order;
  }

  async markRefunded(manager: EntityManager, order: BizOrder): Promise<BizOrder> {
    this.safeTransition(order.status, OrderStatus.REFUNDED);
    order.status = OrderStatus.REFUNDED;
    await manager.save(order);

    const items = await manager.find(BizOrderItem, {
      where: { orderId: order.id, isDeleted: 0 },
    });
    for (const item of items) {
      await this.productService.adjustStock(manager, item.skuId, item.quantity);
    }
    const salesByProduct = new Map<string, number>();
    for (const item of items) {
      salesByProduct.set(item.productId, (salesByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [productId, qty] of salesByProduct) {
      await this.productService.increaseSales(manager, productId, -qty);
    }
    await this.orderBenefits.releaseOrder(manager, order, PointsBizType.ORDER_REFUND_RETURN);
    return order;
  }

  publishPaid(order: BizOrder): void {
    this.emit(ORDER_EVENTS.PAID, order);
  }

  publishRefunded(order: BizOrder): void {
    this.emit(ORDER_EVENTS.REFUNDED, order);
  }

  async cancelByMember(memberId: string, id: string, reason?: string) {
    const order = await this.cancelInternal(id, reason || "用户取消", memberId);
    return this.getDetail(order.id, memberId);
  }

  async cancelUnpaidBySystem(id: string, reason: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!order || order.status !== OrderStatus.UNPAID) return;
    try {
      await this.cancelInternal(id, reason);
    } catch (error) {
      const latest = await this.orderRepository.findOne({ where: { id, isDeleted: 0 } });
      if (latest && latest.status !== OrderStatus.UNPAID) return;
      throw error;
    }
  }

  async cancelExpiredUnpaid(): Promise<number> {
    const timeoutMinutes = this.configService.get<number>("ORDER_PAY_TIMEOUT_MINUTES", 30);
    const expireBefore = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const list = await this.orderRepository.find({
      where: { status: OrderStatus.UNPAID, isDeleted: 0, createTime: LessThan(expireBefore) },
    });
    let count = 0;
    for (const order of list) {
      try {
        await this.cancelInternal(order.id, "支付超时自动取消");
        count += 1;
      } catch (err) {
        this.logger.warn(`超时取消失败 orderId=${order.id}: ${String(err)}`);
      }
    }
    return count;
  }

  async verifyById(id: string, operatorId: string) {
    return this.verifyInternal(id, undefined, operatorId);
  }

  async verifyByCode(verifyCode: string, operatorId: string) {
    const order = await this.orderRepository.findOne({
      where: { verifyCode, isDeleted: 0 },
    });
    if (!order) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "核销码无效" });
    }
    return this.verifyInternal(order.id, undefined, operatorId);
  }

  async adminPage(query: OrderQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.adminQueryBuilder(query);
    const [list, total] = await qb
      .orderBy("o.createTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const memberIds = Array.from(new Set(list.map((o) => String(o.memberId))));
    const members = memberIds.length
      ? await this.memberRepository.find({ where: { id: In(memberIds) } })
      : [];
    const memberMap = new Map(members.map((m) => [String(m.id), m]));

    return {
      data: list.map((o) => {
        const member = memberMap.get(String(o.memberId));
        return {
          ...this.toListVo(o),
          contactName: o.contactName,
          contactMobile: o.contactMobile,
          memberNickname: member?.nickname ?? "",
          memberMobile: member?.mobile ?? "",
        };
      }),
      page: { pageNum, pageSize, total },
    };
  }

  async listExport(query: OrderQueryDto) {
    const list = await this.adminQueryBuilder(query).orderBy("o.createTime", "DESC").getMany();
    const memberIds = Array.from(new Set(list.map((o) => String(o.memberId))));
    const members = memberIds.length
      ? await this.memberRepository.find({ where: { id: In(memberIds) } })
      : [];
    const memberMap = new Map(members.map((m) => [String(m.id), m]));
    return list.map((o) => {
      const member = memberMap.get(String(o.memberId));
      return {
        orderNo: o.orderNo,
        statusLabel: ORDER_STATUS_LABEL[o.status] ?? String(o.status),
        totalAmount: o.totalAmount,
        payAmount: o.payAmount,
        memberNickname: member?.nickname ?? "",
        memberMobile: member?.mobile ?? "",
        contactName: o.contactName ?? "",
        contactMobile: o.contactMobile ?? "",
        verifyCode: o.verifyCode ?? "",
        createTime: o.createTime,
        payTime: o.payTime,
      };
    });
  }

  private adminQueryBuilder(query: OrderQueryDto) {
    const qb = this.orderRepository.createQueryBuilder("o").where("o.isDeleted = 0");
    if (query.status !== undefined) {
      qb.andWhere("o.status = :status", { status: query.status });
    }
    if (query.keywords) {
      qb.leftJoin(Member, "m", "m.id = o.memberId").andWhere(
        "(o.orderNo LIKE :kw OR o.contactMobile LIKE :kw OR m.nickname LIKE :kw OR m.mobile LIKE :kw)",
        { kw: `%${query.keywords}%` }
      );
    }
    if (query.memberId) {
      qb.andWhere("o.memberId = :memberId", { memberId: query.memberId });
    }
    return qb;
  }

  private async verifyInternal(id: string, _unused: undefined, operatorId: string) {
    const order = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockOrder(manager, id);
      this.safeTransition(current.status, OrderStatus.VERIFIED);
      current.status = OrderStatus.VERIFIED;
      current.verifyTime = new Date();
      current.verifyBy = operatorId;
      await manager.save(current);

      this.safeTransition(current.status, OrderStatus.COMPLETED);
      current.status = OrderStatus.COMPLETED;
      await manager.save(current);
      await this.orderBenefits.completeOrder(manager, current);
      return current;
    });

    this.emit(ORDER_EVENTS.VERIFIED, order);
    this.emit(ORDER_EVENTS.COMPLETED, order);
    return this.getDetail(order.id);
  }

  private async cancelInternal(id: string, reason: string, memberId?: string) {
    const order = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockOrder(manager, id);
      if (memberId && String(current.memberId) !== String(memberId)) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "订单不存在" });
      }
      this.safeTransition(current.status, OrderStatus.CANCELLED);
      current.status = OrderStatus.CANCELLED;
      current.cancelTime = new Date();
      current.cancelReason = reason;
      await manager.save(current);

      const items = await manager.find(BizOrderItem, { where: { orderId: id, isDeleted: 0 } });
      for (const item of items) {
        await this.productService.adjustStock(manager, item.skuId, item.quantity);
      }
      await this.orderBenefits.releaseOrder(manager, current, PointsBizType.ORDER_CANCEL_RETURN);
      return current;
    });

    this.emit(ORDER_EVENTS.CANCELLED, order);
    return order;
  }

  private async resolveCreateLines(manager: EntityManager, memberId: string, dto: OrderCreateDto) {
    if (dto.cartIds?.length) {
      const rows = await this.cartService.findOwnedByIds(manager, memberId, dto.cartIds);
      return rows.map((row) => ({ skuId: String(row.skuId), quantity: row.quantity }));
    }
    if (dto.items?.length) {
      return dto.items.map((item) => ({ skuId: item.skuId, quantity: item.quantity }));
    }
    throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "请选择要结算的商品" });
  }

  private async lockOrder(manager: EntityManager, id: string): Promise<BizOrder> {
    const order = await manager.findOne(BizOrder, {
      where: { id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!order) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "订单不存在" });
    }
    return order;
  }

  private safeTransition(from: number, to: number) {
    try {
      assertTransition(from, to);
    } catch {
      throw new BusinessException({
        ...ErrorCode.USER_ERROR,
        msg: `当前订单状态不可执行该操作（${ORDER_STATUS_LABEL[from] ?? from}）`,
      });
    }
  }

  private nextOrderNo(): string {
    const now = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = pad(Math.floor(Math.random() * 10000), 4);
    return `YJ${stamp}${rand}`;
  }

  private async nextVerifyCode(manager: EntityManager): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      const exists = await manager.findOne(BizOrder, { where: { verifyCode: code } });
      if (!exists) return code;
    }
    return `${Date.now()}`.slice(-8);
  }

  private emit(event: string, order: BizOrder) {
    const payload: OrderEventPayload = {
      orderId: String(order.id),
      orderNo: order.orderNo,
      memberId: String(order.memberId),
    };
    this.domainEvents.emit(event, payload);
  }

  private toListVo(order: BizOrder) {
    return {
      id: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      status: order.status,
      statusLabel: ORDER_STATUS_LABEL[order.status] ?? String(order.status),
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      payAmount: order.payAmount,
      payType: order.payType,
      payTime: order.payTime,
      createTime: order.createTime,
    };
  }
}
