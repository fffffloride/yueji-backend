import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, LessThanOrEqual, Repository } from "typeorm";

import {
  GroupBuyActivityStatus,
  GroupBuyMemberStatus,
  GroupBuyStatus,
} from "./group-buy.constants";
import {
  GroupBuyActivityFormDto,
  GroupBuyActivityQueryDto,
  GroupBuyGroupQueryDto,
} from "./dto/group-buy.dto";
import { GroupBuyActivity } from "./entities/group-buy-activity.entity";
import { GroupBuyGroup } from "./entities/group-buy-group.entity";
import { GroupBuyMember } from "./entities/group-buy-member.entity";
import { groupExpireTime, hasGroupCapacity, resolveFormingStatus } from "./group-buy.rules";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { DomainEvents } from "@/common/events/domain-events";
import { Member } from "@/member/entities/member.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { ORDER_EVENTS, OrderEventPayload } from "@/order/order.events";
import { OrderStatus } from "@/order/order-status";
import { OrderService } from "@/order/order.service";
import { PaymentService } from "@/payment/payment.service";
import { Product } from "@/product/entities/product.entity";
import { ProductSku } from "@/product/entities/product-sku.entity";

@Injectable()
export class GroupBuyService implements OnModuleInit {
  private readonly logger = new Logger(GroupBuyService.name);

  constructor(
    @InjectRepository(GroupBuyActivity)
    private readonly activityRepository: Repository<GroupBuyActivity>,
    @InjectRepository(GroupBuyGroup)
    private readonly groupRepository: Repository<GroupBuyGroup>,
    @InjectRepository(GroupBuyMember)
    private readonly groupMemberRepository: Repository<GroupBuyMember>,
    private readonly dataSource: DataSource,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly events: DomainEvents
  ) {}

  onModuleInit() {
    this.events.on<OrderEventPayload>(ORDER_EVENTS.PAID, ({ orderId }) => {
      void this.syncOrder(orderId, OrderStatus.PAID).catch((error) =>
        this.logger.warn(`同步拼团支付失败 orderId=${orderId}: ${String(error)}`)
      );
    });
    this.events.on<OrderEventPayload>(ORDER_EVENTS.CANCELLED, ({ orderId }) => {
      void this.syncOrder(orderId, OrderStatus.CANCELLED).catch((error) =>
        this.logger.warn(`同步拼团取消失败 orderId=${orderId}: ${String(error)}`)
      );
    });
    this.events.on<OrderEventPayload>(ORDER_EVENTS.REFUNDED, ({ orderId }) => {
      void this.syncOrder(orderId, OrderStatus.REFUNDED).catch((error) =>
        this.logger.warn(`同步拼团退款失败 orderId=${orderId}: ${String(error)}`)
      );
    });
  }

  async activityPage(query: GroupBuyActivityQueryDto, appOnly = false) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const now = new Date();
    const qb = this.activityRepository.createQueryBuilder("a").where("a.isDeleted = 0");
    if (appOnly) {
      qb.andWhere("a.status = 1").andWhere("a.startTime <= :now AND a.endTime > :now", { now });
    } else if (query.status !== undefined) {
      qb.andWhere("a.status = :status", { status: query.status });
    }
    if (query.keywords) qb.andWhere("a.name LIKE :kw", { kw: `%${query.keywords}%` });
    const [rows, total] = await qb
      .orderBy("a.startTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data: await this.hydrateActivities(rows), page: { pageNum, pageSize, total } };
  }

  async activityForm(id: string) {
    const activity = await this.findActivity(id);
    return (await this.hydrateActivities([activity]))[0];
  }

  async createActivity(dto: GroupBuyActivityFormDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.validateActivity(manager, dto);
      return manager.save(manager.create(GroupBuyActivity, { ...dto, isDeleted: 0 }));
    });
  }

  async updateActivity(id: string, dto: GroupBuyActivityFormDto) {
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(GroupBuyActivity, {
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!current) throw this.userError("拼团活动不存在");
      const groupCount = await manager.count(GroupBuyGroup, {
        where: { activityId: id, isDeleted: 0 },
      });
      if (groupCount > 0) {
        const immutableChanged =
          String(dto.skuId) !== String(current.skuId) ||
          dto.groupPrice !== current.groupPrice ||
          dto.requiredPeople !== current.requiredPeople ||
          dto.groupDurationMinutes !== current.groupDurationMinutes ||
          dto.startTime.getTime() !== current.startTime.getTime();
        if (immutableChanged) throw this.userError("已有拼团记录，只能修改名称、结束时间和状态");
        const latest = await manager.findOne(GroupBuyGroup, {
          where: { activityId: id, isDeleted: 0 },
          order: { expireTime: "DESC" },
        });
        if (latest && dto.endTime < latest.expireTime)
          throw this.userError("结束时间不能早于已有团截止时间");
      }
      await this.validateActivity(manager, dto, id);
      Object.assign(current, dto);
      return manager.save(current);
    });
  }

  async updateActivityStatus(id: string, status: number) {
    const row = await this.findActivity(id);
    row.status = status;
    await this.activityRepository.save(row);
  }

  async removeActivity(id: string) {
    const count = await this.groupRepository.count({ where: { activityId: id, isDeleted: 0 } });
    if (count > 0) throw this.userError("已有拼团记录的活动不能删除");
    const row = await this.findActivity(id);
    row.isDeleted = 1;
    await this.activityRepository.save(row);
  }

  async appActivityDetail(id: string) {
    const activity = await this.findActivity(id);
    const now = new Date();
    if (
      activity.status !== GroupBuyActivityStatus.ONLINE ||
      activity.startTime > now ||
      activity.endTime <= now
    ) {
      throw this.userError("拼团活动不可用");
    }
    const groups = await this.groupRepository.find({
      where: { activityId: id, status: GroupBuyStatus.FORMING, isDeleted: 0 },
      order: { expireTime: "ASC" },
      take: 20,
    });
    const data = (await this.hydrateActivities([activity]))[0];
    return {
      ...data,
      groups: await Promise.all(
        groups.filter((g) => g.expireTime > now).map((g) => this.groupVo(g))
      ),
    };
  }

  start(memberId: string, activityId: string) {
    return this.dataSource.transaction(async (manager) => {
      const activity = await this.lockAvailableActivity(manager, activityId);
      const now = new Date();
      const expireTime = groupExpireTime(now, activity.groupDurationMinutes, activity.endTime);
      const group = await manager.save(
        manager.create(GroupBuyGroup, {
          activityId: activity.id,
          leaderMemberId: memberId,
          requiredPeople: activity.requiredPeople,
          groupPrice: activity.groupPrice,
          expireTime,
          status: GroupBuyStatus.FORMING,
          isDeleted: 0,
        })
      );
      const order = await this.orderService.createGroupBuyOrder(
        manager,
        memberId,
        activity.skuId,
        activity.groupPrice,
        `拼团活动：${activity.name}`
      );
      await manager.save(
        manager.create(GroupBuyMember, {
          groupId: group.id,
          memberId,
          orderId: order.id,
          status: GroupBuyMemberStatus.PENDING,
          isDeleted: 0,
        })
      );
      return this.orderResult(group, order);
    });
  }

  join(memberId: string, groupId: string) {
    return this.dataSource.transaction(async (manager) => {
      const group = await manager.findOne(GroupBuyGroup, {
        where: { id: groupId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!group || group.status !== GroupBuyStatus.FORMING || group.expireTime <= new Date()) {
        throw this.userError("该拼团不可加入");
      }
      const duplicate = await manager.findOne(GroupBuyMember, {
        where: { groupId, memberId, isDeleted: 0 },
      });
      if (duplicate) throw this.userError("不能重复加入同一拼团");
      const activeCount = await manager.count(GroupBuyMember, {
        where: {
          groupId,
          status: In([GroupBuyMemberStatus.PENDING, GroupBuyMemberStatus.PAID]),
          isDeleted: 0,
        },
      });
      if (!hasGroupCapacity(activeCount, group.requiredPeople))
        throw this.userError("该拼团人数已满");
      const activity = await manager.findOne(GroupBuyActivity, {
        where: { id: group.activityId, isDeleted: 0 },
        lock: { mode: "pessimistic_read" },
      });
      if (!activity) throw this.userError("拼团活动不存在");
      const order = await this.orderService.createGroupBuyOrder(
        manager,
        memberId,
        activity.skuId,
        group.groupPrice,
        `参与拼团：${activity.name}`
      );
      await manager.save(
        manager.create(GroupBuyMember, {
          groupId,
          memberId,
          orderId: order.id,
          status: GroupBuyMemberStatus.PENDING,
          isDeleted: 0,
        })
      );
      return this.orderResult(group, order);
    });
  }

  async groupDetail(id: string, admin = false) {
    const group = await this.groupRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!group) throw this.userError("拼团不存在");
    const activity = await this.activityRepository.findOne({ where: { id: group.activityId } });
    const members = await this.dataSource
      .createQueryBuilder()
      .select([
        "gm.id AS id",
        "gm.member_id AS memberId",
        "gm.order_id AS orderId",
        "gm.status AS status",
        "gm.paid_time AS paidTime",
        "m.nickname AS nickname",
        "m.avatar AS avatar",
        ...(admin
          ? ["m.mobile AS mobile", "o.order_no AS orderNo", "o.status AS orderStatus"]
          : []),
      ])
      .from(GroupBuyMember, "gm")
      .innerJoin(Member, "m", "m.id = gm.member_id AND m.is_deleted = 0")
      .innerJoin(BizOrder, "o", "o.id = gm.order_id AND o.is_deleted = 0")
      .where("gm.group_id = :id AND gm.is_deleted = 0", { id })
      .orderBy("gm.id", "ASC")
      .getRawMany();
    return { ...(await this.groupVo(group)), activityName: activity?.name ?? "", members };
  }

  async groupPage(query: GroupBuyGroupQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.groupRepository.createQueryBuilder("g").where("g.isDeleted = 0");
    if (query.activityId)
      qb.andWhere("g.activityId = :activityId", { activityId: query.activityId });
    if (query.status !== undefined) qb.andWhere("g.status = :status", { status: query.status });
    const [groups, total] = await qb
      .orderBy("g.createTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const activityIds = [...new Set(groups.map((g) => g.activityId))];
    const activities = activityIds.length
      ? await this.activityRepository.find({ where: { id: In(activityIds) } })
      : [];
    const names = new Map(activities.map((a) => [String(a.id), a.name]));
    const data = await Promise.all(
      groups.map(async (g) => ({
        ...(await this.groupVo(g)),
        activityName: names.get(String(g.activityId)) ?? "",
      }))
    );
    return { data, page: { pageNum, pageSize, total } };
  }

  async syncOrder(orderId: string, orderStatus: number) {
    await this.dataSource.transaction(async (manager) => {
      const member = await manager.findOne(GroupBuyMember, {
        where: { orderId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!member) return;
      if (orderStatus === OrderStatus.PAID && member.status === GroupBuyMemberStatus.PENDING) {
        member.status = GroupBuyMemberStatus.PAID;
        member.paidTime = new Date();
        await manager.save(member);
        const group = await manager.findOne(GroupBuyGroup, {
          where: { id: member.groupId, isDeleted: 0 },
          lock: { mode: "pessimistic_write" },
        });
        if (!group || group.status !== GroupBuyStatus.FORMING) return;
        const paid = await manager.count(GroupBuyMember, {
          where: { groupId: group.id, status: GroupBuyMemberStatus.PAID, isDeleted: 0 },
        });
        const nextStatus = resolveFormingStatus(
          new Date(),
          group.expireTime,
          paid,
          group.requiredPeople
        );
        if (nextStatus === GroupBuyStatus.FAILED) {
          group.status = GroupBuyStatus.FAILED;
          group.failTime = new Date();
          await manager.save(group);
          return;
        }
        if (nextStatus === GroupBuyStatus.SUCCESS) {
          group.status = GroupBuyStatus.SUCCESS;
          group.successTime = new Date();
          await manager.save(group);
        }
      } else if (
        orderStatus === OrderStatus.CANCELLED &&
        member.status === GroupBuyMemberStatus.PENDING
      ) {
        member.status = GroupBuyMemberStatus.CANCELLED;
        await manager.save(member);
      } else if (
        orderStatus === OrderStatus.REFUNDED &&
        member.status === GroupBuyMemberStatus.PAID
      ) {
        member.status = GroupBuyMemberStatus.REFUNDED;
        member.refundTime = new Date();
        await manager.save(member);
      }
    });
  }

  async reconcile(): Promise<void> {
    const rows: Array<{ orderId: string; orderStatus: number }> = await this.dataSource.query(
      `SELECT gm.order_id AS orderId, o.status AS orderStatus
       FROM group_buy_member gm JOIN biz_order o ON o.id = gm.order_id
       WHERE gm.is_deleted = 0 AND ((gm.status = 0 AND o.status IN (1,4,5)) OR (gm.status = 1 AND o.status = 5))
       LIMIT 200`
    );
    for (const row of rows) await this.syncOrder(String(row.orderId), Number(row.orderStatus));

    const expired = await this.groupRepository.find({
      where: {
        status: GroupBuyStatus.FORMING,
        expireTime: LessThanOrEqual(new Date()),
        isDeleted: 0,
      },
      take: 100,
    });
    for (const group of expired) await this.failExpiredGroup(group.id);

    const retryGroups: Array<{ groupId: string }> = await this.dataSource.query(
      `SELECT DISTINCT gm.group_id AS groupId FROM group_buy_member gm
       JOIN group_buy_group gg ON gg.id = gm.group_id
       WHERE gm.is_deleted = 0 AND gm.status = 1 AND gg.status = 2 LIMIT 100`
    );
    for (const row of retryGroups) await this.settleFailedGroup(String(row.groupId));
  }

  private async failExpiredGroup(id: string) {
    const changed = await this.dataSource.transaction(async (manager) => {
      const group = await manager.findOne(GroupBuyGroup, {
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!group || group.status !== GroupBuyStatus.FORMING || group.expireTime > new Date())
        return false;
      group.status = GroupBuyStatus.FAILED;
      group.failTime = new Date();
      await manager.save(group);
      return true;
    });
    if (changed) await this.settleFailedGroup(id);
  }

  private async settleFailedGroup(groupId: string) {
    const pending = await this.groupMemberRepository.find({
      where: { groupId, status: GroupBuyMemberStatus.PENDING, isDeleted: 0 },
    });
    for (const member of pending) {
      try {
        await this.orderService.cancelUnpaidBySystem(member.orderId, "拼团超时未成团");
        await this.syncOrder(member.orderId, OrderStatus.CANCELLED);
      } catch (error) {
        this.logger.warn(`拼团订单取消失败 orderId=${member.orderId}: ${String(error)}`);
      }
    }
    const members = await this.groupMemberRepository.find({
      where: { groupId, status: GroupBuyMemberStatus.PAID, isDeleted: 0 },
    });
    for (const member of members) {
      try {
        await this.paymentService.refundByOrder(member.orderId, "拼团超时未成团");
        await this.syncOrder(member.orderId, OrderStatus.REFUNDED);
      } catch (error) {
        this.logger.warn(`拼团退款失败 orderId=${member.orderId}: ${String(error)}`);
      }
    }
  }

  private async validateActivity(
    manager: EntityManager,
    dto: GroupBuyActivityFormDto,
    excludeId?: string
  ) {
    if (dto.startTime >= dto.endTime) throw this.userError("活动结束时间必须晚于开始时间");
    if (dto.endTime <= new Date()) throw this.userError("活动结束时间必须晚于当前时间");
    const sku = await manager.findOne(ProductSku, {
      where: { id: dto.skuId, status: 1, isDeleted: 0 },
    });
    const product = sku
      ? await manager.findOne(Product, { where: { id: sku.productId, status: 1, isDeleted: 0 } })
      : null;
    if (!sku || !product) throw this.userError("SKU不可用");
    if (dto.groupPrice >= sku.price) throw this.userError("拼团价必须低于SKU售价");
    const overlap = manager
      .createQueryBuilder(GroupBuyActivity, "a")
      .where("a.skuId = :skuId AND a.isDeleted = 0", { skuId: dto.skuId })
      .andWhere("a.startTime < :endTime AND a.endTime > :startTime", {
        startTime: dto.startTime,
        endTime: dto.endTime,
      });
    if (excludeId) overlap.andWhere("a.id != :excludeId", { excludeId });
    if (await overlap.getExists()) throw this.userError("同一SKU的活动时间不能重叠");
  }

  private async lockAvailableActivity(manager: EntityManager, id: string) {
    const activity = await manager.findOne(GroupBuyActivity, {
      where: { id, status: GroupBuyActivityStatus.ONLINE, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    const now = new Date();
    if (!activity || activity.startTime > now || activity.endTime <= now)
      throw this.userError("拼团活动不可用");
    return activity;
  }

  private async findActivity(id: string) {
    const row = await this.activityRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!row) throw this.userError("拼团活动不存在");
    return row;
  }

  private async hydrateActivities(rows: GroupBuyActivity[]) {
    const skuIds = [...new Set(rows.map((row) => row.skuId))];
    const skus = skuIds.length
      ? await this.dataSource.manager.find(ProductSku, { where: { id: In(skuIds) } })
      : [];
    const productIds = [...new Set(skus.map((sku) => sku.productId))];
    const products = productIds.length
      ? await this.dataSource.manager.find(Product, { where: { id: In(productIds) } })
      : [];
    const skuMap = new Map(skus.map((sku) => [String(sku.id), sku]));
    const productMap = new Map(products.map((product) => [String(product.id), product]));
    return rows.map((row) => {
      const sku = skuMap.get(String(row.skuId));
      const product = sku ? productMap.get(String(sku.productId)) : undefined;
      return {
        ...row,
        skuName: sku?.name ?? "",
        skuPrice: sku?.price ?? 0,
        productId: product?.id ?? null,
        productName: product?.name ?? "",
        productImage: product?.mainImage ?? null,
      };
    });
  }

  private async groupVo(group: GroupBuyGroup) {
    const [paidPeople, occupiedPeople] = await Promise.all([
      this.groupMemberRepository.count({
        where: { groupId: group.id, status: GroupBuyMemberStatus.PAID, isDeleted: 0 },
      }),
      this.groupMemberRepository.count({
        where: {
          groupId: group.id,
          status: In([GroupBuyMemberStatus.PENDING, GroupBuyMemberStatus.PAID]),
          isDeleted: 0,
        },
      }),
    ]);
    return { ...group, paidPeople, occupiedPeople };
  }

  private orderResult(group: GroupBuyGroup, order: BizOrder) {
    return {
      groupId: group.id,
      orderId: order.id,
      orderNo: order.orderNo,
      groupPrice: group.groupPrice,
      expireTime: group.expireTime,
    };
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
