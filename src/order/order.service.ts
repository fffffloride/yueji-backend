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
import { calcPricing } from "./pricing";
import { ORDER_EVENTS, type OrderEventPayload } from "./order.events";
import { CartService } from "@/cart/cart.service";
import { ProductService } from "@/product/product.service";
import { Member } from "@/member/entities/member.entity";
import { DomainEvents } from "@/common/events/domain-events";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

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
    private readonly domainEvents: DomainEvents,
    private readonly configService: ConfigService
  ) {}

  async create(memberId: string, dto: OrderCreateDto) {
    const order = await this.dataSource.transaction(async (manager) => {
      const lines = await this.resolveCreateLines(manager, memberId, dto);
      if (lines.length === 0) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "请选择要结算的商品" });
      }
      lines.sort((a, b) => a.skuId.localeCompare(b.skuId));
      const pricedLines: {
        skuId: string;
        productId: string;
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

      const pricing = calcPricing(pricedLines);
      const created = manager.create(BizOrder, {
        orderNo: this.nextOrderNo(),
        memberId,
        status: OrderStatus.UNPAID,
        totalAmount: pricing.totalAmount,
        discountAmount: pricing.discountAmount,
        payAmount: pricing.payAmount,
        contactName: dto.contactName ?? null,
        contactMobile: dto.contactMobile ?? null,
        remark: dto.remark ?? null,
        isDeleted: 0,
      });
      await manager.save(created);

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

      return created;
    });

    return this.getDetail(order.id, memberId);
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
        memberDiscount: 0,
        couponAmount: 0,
        pointsDeduct: 0,
        discountAmount: order.discountAmount,
        payAmount: order.payAmount,
      },
    };
  }

  async mockPay(memberId: string, id: string) {
    const order = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockOrder(manager, id);
      if (String(current.memberId) !== String(memberId)) {
        throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "订单不存在" });
      }
      this.safeTransition(current.status, OrderStatus.PAID);
      current.status = OrderStatus.PAID;
      current.payType = 1;
      current.payTime = new Date();
      current.verifyCode = await this.nextVerifyCode(manager);
      await manager.save(current);

      const items = await manager.find(BizOrderItem, { where: { orderId: id, isDeleted: 0 } });
      const salesByProduct = new Map<string, number>();
      for (const item of items) {
        salesByProduct.set(
          item.productId,
          (salesByProduct.get(item.productId) ?? 0) + item.quantity
        );
      }
      for (const [productId, qty] of salesByProduct) {
        await this.productService.increaseSales(manager, productId, qty);
      }
      return current;
    });

    this.emit(ORDER_EVENTS.PAID, order);
    return this.getDetail(order.id, memberId);
  }

  async cancelByMember(memberId: string, id: string, reason?: string) {
    const order = await this.cancelInternal(id, reason || "用户取消", memberId);
    return this.getDetail(order.id, memberId);
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
