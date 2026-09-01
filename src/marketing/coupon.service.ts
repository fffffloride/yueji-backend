import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";

import {
  CouponScopeType,
  CouponTemplateStatus,
  CouponType,
  MemberCouponStatus,
} from "./marketing.constants";
import {
  ClaimableCouponQueryDto,
  CouponQueryDto,
  CouponSaveDto,
  MemberCouponQueryDto,
} from "./dto/marketing.dto";
import { Coupon } from "./entities/coupon.entity";
import { CouponScope } from "./entities/coupon-scope.entity";
import { MemberCoupon } from "./entities/member-coupon.entity";
import { Member } from "@/member/entities/member.entity";
import { ProductSku } from "@/product/entities/product-sku.entity";
import { Product } from "@/product/entities/product.entity";
import { ProductCategory } from "@/product/entities/product-category.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponScope)
    private readonly scopeRepository: Repository<CouponScope>,
    @InjectRepository(MemberCoupon)
    private readonly memberCouponRepository: Repository<MemberCoupon>,
    private readonly dataSource: DataSource
  ) {}

  async page(query: CouponQueryDto) {
    const qb = this.couponRepository.createQueryBuilder("coupon").where("coupon.isDeleted = 0");
    if (query.keywords) qb.andWhere("coupon.name LIKE :kw", { kw: `%${query.keywords}%` });
    if (query.type) qb.andWhere("coupon.type = :type", { type: query.type });
    if (query.status !== undefined)
      qb.andWhere("coupon.status = :status", { status: query.status });
    const [rows, total] = await qb
      .orderBy("coupon.createTime", "DESC")
      .skip((query.pageNum - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    const scopeMap = await this.scopeMap(rows.map((item) => item.id));
    return {
      data: rows.map((item) => ({ ...item, scopeIds: scopeMap.get(String(item.id)) ?? [] })),
      page: { pageNum: query.pageNum, pageSize: query.pageSize, total },
    };
  }

  async detail(id: string) {
    const coupon = await this.get(id);
    const scopes = await this.scopeRepository.find({ where: { couponId: id, isDeleted: 0 } });
    return { ...coupon, scopeIds: scopes.map((item) => item.targetId) };
  }

  async create(dto: CouponSaveDto) {
    this.validate(dto);
    return this.dataSource.transaction(async (manager) => {
      await this.assertScopeTargets(manager, dto);
      const coupon = await manager.save(
        manager.create(Coupon, {
          ...this.toEntity(dto),
          issuedQuantity: 0,
          isDeleted: 0,
        })
      );
      await this.replaceScopes(manager, coupon.id, dto);
      return coupon;
    });
  }

  async update(id: string, dto: CouponSaveDto) {
    this.validate(dto);
    return this.dataSource.transaction(async (manager) => {
      const coupon = await manager.findOne(Coupon, {
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!coupon) throw this.userError("优惠券不存在");
      if (coupon.issuedQuantity > 0) {
        this.assertIssuedFieldsFrozen(coupon, dto);
        const scopes = await manager.find(CouponScope, {
          where: { couponId: id, isDeleted: 0 },
        });
        const currentIds = scopes.map((item) => String(item.targetId)).sort();
        const nextIds = [...(dto.scopeIds ?? [])].map(String).sort();
        if (currentIds.join(",") !== nextIds.join(",")) {
          throw this.userError("已有领取记录，不能修改适用范围");
        }
      }
      await this.assertScopeTargets(manager, dto);
      Object.assign(coupon, this.toEntity(dto));
      await manager.save(coupon);
      if (coupon.issuedQuantity === 0) await this.replaceScopes(manager, coupon.id, dto);
      return coupon;
    });
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const coupon = await manager.findOne(Coupon, {
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!coupon) throw this.userError("优惠券不存在");
      if (coupon.issuedQuantity > 0) throw this.userError("已有领取记录的优惠券不能删除");
      coupon.isDeleted = 1;
      await manager.save(coupon);
      return true;
    });
  }

  async claim(memberId: string, couponId: string) {
    return this.dataSource.transaction((manager) =>
      this.issueOne(manager, memberId, couponId, true)
    );
  }

  async issue(couponId: string, memberIds: string[]) {
    const uniqueIds = [...new Set(memberIds.map(String))];
    return this.dataSource.transaction(async (manager) => {
      const coupon = await this.lockActiveCoupon(manager, couponId, false);
      const existingMembers = await manager.find(Member, {
        where: { id: In(uniqueIds), isDeleted: 0 },
      });
      if (existingMembers.length !== uniqueIds.length) throw this.userError("部分会员不存在");
      const counts = await manager
        .createQueryBuilder(MemberCoupon, "mc")
        .select("mc.memberId", "memberId")
        .addSelect("COUNT(*)", "count")
        .where("mc.couponId = :couponId", { couponId })
        .andWhere("mc.memberId IN (:...memberIds)", { memberIds: uniqueIds })
        .andWhere("mc.isDeleted = 0")
        .groupBy("mc.memberId")
        .getRawMany<{ memberId: string; count: string }>();
      const countMap = new Map(counts.map((item) => [String(item.memberId), Number(item.count)]));
      const eligibleIds = uniqueIds.filter(
        (memberId) => (countMap.get(String(memberId)) ?? 0) < coupon.perMemberLimit
      );
      if (coupon.issuedQuantity + eligibleIds.length > coupon.totalQuantity) {
        throw this.userError("优惠券库存不足");
      }
      const now = new Date();
      const issued = eligibleIds.map((memberId) =>
        manager.create(MemberCoupon, {
          couponId: coupon.id,
          memberId,
          status: MemberCouponStatus.UNUSED,
          claimedAt: now,
          isDeleted: 0,
        })
      );
      if (issued.length > 0) await manager.save(issued);
      coupon.issuedQuantity += issued.length;
      await manager.save(coupon);
      return { issued: issued.length, skipped: uniqueIds.length - issued.length };
    });
  }

  async claimable(memberId: string, query: ClaimableCouponQueryDto) {
    const now = new Date();
    const qb = this.couponRepository
      .createQueryBuilder("coupon")
      .where("coupon.isDeleted = 0")
      .andWhere("coupon.status = :status", { status: CouponTemplateStatus.ACTIVE })
      .andWhere("coupon.claimStart <= :now AND coupon.claimEnd >= :now", { now })
      .andWhere("coupon.validEnd >= :now")
      .andWhere("coupon.issuedQuantity < coupon.totalQuantity")
      .andWhere(
        `(SELECT COUNT(*) FROM member_coupon mc
          WHERE mc.coupon_id = coupon.id
            AND mc.member_id = :memberId
            AND mc.is_deleted = 0) < coupon.perMemberLimit`,
        { memberId }
      )
      .orderBy("coupon.validEnd", "ASC")
      .addOrderBy("coupon.id", "ASC")
      .skip((query.pageNum - 1) * query.pageSize)
      .take(query.pageSize);
    const [coupons, total] = await qb.getManyAndCount();
    const counts = coupons.length
      ? await this.memberCouponRepository
          .createQueryBuilder("mc")
          .select("mc.couponId", "couponId")
          .addSelect("COUNT(*)", "count")
          .where("mc.memberId = :memberId", { memberId })
          .andWhere("mc.couponId IN (:...ids)", { ids: coupons.map((item) => item.id) })
          .andWhere("mc.isDeleted = 0")
          .groupBy("mc.couponId")
          .getRawMany<{ couponId: string; count: string }>()
      : [];
    const countMap = new Map(counts.map((item) => [String(item.couponId), Number(item.count)]));
    return {
      data: coupons.map((coupon) => ({
        ...coupon,
        receivedCount: countMap.get(String(coupon.id)) ?? 0,
        canClaim: true,
      })),
      page: { pageNum: query.pageNum, pageSize: query.pageSize, total },
    };
  }

  async mine(memberId: string, query: MemberCouponQueryDto) {
    return this.memberCouponPage({ ...query, memberId }, memberId);
  }

  async memberCouponPage(query: MemberCouponQueryDto, ownedMemberId?: string) {
    await this.expireCoupons(ownedMemberId ?? query.memberId);
    const qb = this.memberCouponRepository.createQueryBuilder("mc").where("mc.isDeleted = 0");
    const memberId = ownedMemberId ?? query.memberId;
    if (memberId) qb.andWhere("mc.memberId = :memberId", { memberId });
    if (query.couponId) qb.andWhere("mc.couponId = :couponId", { couponId: query.couponId });
    if (query.status !== undefined) qb.andWhere("mc.status = :status", { status: query.status });
    const [rows, total] = await qb
      .orderBy("mc.createTime", "DESC")
      .skip((query.pageNum - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    const couponIds = [...new Set(rows.map((item) => item.couponId))];
    const memberIds = [...new Set(rows.map((item) => item.memberId))];
    const [coupons, members] = await Promise.all([
      couponIds.length
        ? this.couponRepository.find({ where: { id: In(couponIds) } })
        : Promise.resolve([]),
      memberIds.length
        ? this.memberCouponRepository.manager.find(Member, { where: { id: In(memberIds) } })
        : Promise.resolve([]),
    ]);
    const couponMap = new Map(coupons.map((item) => [String(item.id), item]));
    const memberMap = new Map(members.map((item) => [String(item.id), item]));
    const now = new Date();
    return {
      data: rows.map((item) => {
        const coupon = couponMap.get(String(item.couponId));
        const effectiveStatus =
          item.status === MemberCouponStatus.UNUSED && coupon && coupon.validEnd < now
            ? MemberCouponStatus.EXPIRED
            : item.status;
        return {
          ...item,
          status: effectiveStatus,
          couponName: coupon?.name ?? "",
          couponType: coupon?.type,
          scopeType: coupon?.scopeType,
          thresholdAmount: coupon?.thresholdAmount ?? 0,
          discountAmount: coupon?.discountAmount ?? 0,
          discountRate: coupon?.discountRate ?? 10000,
          maxDiscountAmount: coupon?.maxDiscountAmount ?? null,
          validStart: coupon?.validStart,
          validEnd: coupon?.validEnd,
          memberNickname: memberMap.get(String(item.memberId))?.nickname ?? "",
          memberMobile: memberMap.get(String(item.memberId))?.mobile ?? "",
        };
      }),
      page: { pageNum: query.pageNum, pageSize: query.pageSize, total },
    };
  }

  private async issueOne(
    manager: EntityManager,
    memberId: string,
    couponId: string,
    enforceClaimWindow: boolean
  ) {
    const coupon = await this.lockActiveCoupon(manager, couponId, enforceClaimWindow);
    const member = await manager.findOne(Member, { where: { id: memberId, isDeleted: 0 } });
    if (!member) throw this.userError("会员不存在");
    const count = await manager.count(MemberCoupon, {
      where: { couponId, memberId, isDeleted: 0 },
    });
    if (count >= coupon.perMemberLimit) throw this.userError("已达到每人限领数量");
    if (coupon.issuedQuantity >= coupon.totalQuantity) throw this.userError("优惠券已领完");
    const memberCoupon = await this.createMemberCoupon(manager, coupon, memberId);
    await manager.save(coupon);
    return memberCoupon;
  }

  private async lockActiveCoupon(
    manager: EntityManager,
    couponId: string,
    enforceClaimWindow: boolean
  ) {
    const coupon = await manager.findOne(Coupon, {
      where: { id: couponId, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!coupon || coupon.status !== CouponTemplateStatus.ACTIVE) {
      throw this.userError("优惠券不可领取");
    }
    const now = new Date();
    if (coupon.validEnd < now) throw this.userError("优惠券已过期");
    if (enforceClaimWindow && (coupon.claimStart > now || coupon.claimEnd < now)) {
      throw this.userError("不在优惠券领取时间内");
    }
    return coupon;
  }

  private async createMemberCoupon(manager: EntityManager, coupon: Coupon, memberId: string) {
    const created = await manager.save(
      manager.create(MemberCoupon, {
        couponId: coupon.id,
        memberId,
        status: MemberCouponStatus.UNUSED,
        claimedAt: new Date(),
        isDeleted: 0,
      })
    );
    coupon.issuedQuantity += 1;
    return created;
  }

  private validate(dto: CouponSaveDto) {
    const claimStart = new Date(dto.claimStart);
    const claimEnd = new Date(dto.claimEnd);
    const validStart = new Date(dto.validStart);
    const validEnd = new Date(dto.validEnd);
    if (claimStart > claimEnd || validStart > validEnd || claimEnd > validEnd) {
      throw this.userError("领取时间和有效期设置不正确");
    }
    if (dto.type === CouponType.FULL_REDUCTION && dto.discountAmount <= 0) {
      throw this.userError("满减券优惠金额必须大于0");
    }
    if (dto.type === CouponType.DISCOUNT && dto.discountRate >= 10000) {
      throw this.userError("折扣券折扣率必须小于10000");
    }
    if (dto.type === CouponType.EXCHANGE && !dto.exchangeSkuId) {
      throw this.userError("兑换券必须选择SKU");
    }
    if (dto.perMemberLimit > dto.totalQuantity) {
      throw this.userError("每人限领数量不能超过发放总量");
    }
    if (
      dto.type !== CouponType.EXCHANGE &&
      dto.scopeType !== CouponScopeType.ALL &&
      !dto.scopeIds?.length
    ) {
      throw this.userError("请选择优惠券适用范围");
    }
  }

  private toEntity(dto: CouponSaveDto) {
    return {
      name: dto.name,
      type: dto.type,
      scopeType: dto.type === CouponType.EXCHANGE ? CouponScopeType.PRODUCT : dto.scopeType,
      thresholdAmount: dto.thresholdAmount,
      discountAmount: dto.discountAmount,
      discountRate: dto.discountRate,
      maxDiscountAmount: dto.maxDiscountAmount ?? null,
      exchangeSkuId: dto.type === CouponType.EXCHANGE ? dto.exchangeSkuId : null,
      claimStart: new Date(dto.claimStart),
      claimEnd: new Date(dto.claimEnd),
      validStart: new Date(dto.validStart),
      validEnd: new Date(dto.validEnd),
      totalQuantity: dto.totalQuantity,
      perMemberLimit: dto.perMemberLimit,
      status: dto.status,
    };
  }

  private async assertScopeTargets(manager: EntityManager, dto: CouponSaveDto) {
    if (dto.type === CouponType.EXCHANGE) {
      const sku = await manager.findOne(ProductSku, {
        where: { id: dto.exchangeSkuId!, isDeleted: 0 },
      });
      if (!sku) throw this.userError("兑换SKU不存在");
      return;
    }
    if (dto.scopeType === CouponScopeType.ALL) return;

    const ids = dto.scopeIds ?? [];
    const target = dto.scopeType === CouponScopeType.CATEGORY ? ProductCategory : Product;
    const count = await manager.count(target, { where: { id: In(ids), isDeleted: 0 } });
    if (count !== ids.length) throw this.userError("优惠券适用范围包含不存在的对象");
  }

  private assertIssuedFieldsFrozen(coupon: Coupon, dto: CouponSaveDto) {
    const next = this.toEntity(dto);
    if (next.validEnd.getTime() < coupon.validEnd.getTime()) {
      throw this.userError("已有领取记录，有效结束时间只能延长");
    }
    const frozen = [
      "type",
      "scopeType",
      "thresholdAmount",
      "discountAmount",
      "discountRate",
      "maxDiscountAmount",
      "exchangeSkuId",
      "claimStart",
      "claimEnd",
      "validStart",
      "totalQuantity",
      "perMemberLimit",
    ] as const;
    if (
      frozen.some((key) => {
        const currentValue = coupon[key];
        const nextValue = next[key];
        if (currentValue instanceof Date && nextValue instanceof Date) {
          return currentValue.getTime() !== nextValue.getTime();
        }
        return String(currentValue ?? "") !== String(nextValue ?? "");
      })
    ) {
      throw this.userError("已有领取记录，仅可修改名称、结束时间和状态");
    }
  }

  private async replaceScopes(manager: EntityManager, couponId: string, dto: CouponSaveDto) {
    const current = await manager.find(CouponScope, { where: { couponId, isDeleted: 0 } });
    if (current.length > 0) {
      for (const scope of current) scope.isDeleted = 1;
      await manager.save(current);
    }
    if (dto.type === CouponType.EXCHANGE || dto.scopeType === CouponScopeType.ALL) return;
    await manager.save(
      (dto.scopeIds ?? []).map((targetId) =>
        manager.create(CouponScope, {
          couponId,
          targetType: dto.scopeType,
          targetId,
          isDeleted: 0,
        })
      )
    );
  }

  private async scopeMap(couponIds: string[]) {
    const map = new Map<string, string[]>();
    if (!couponIds.length) return map;
    const scopes = await this.scopeRepository.find({
      where: { couponId: In(couponIds), isDeleted: 0 },
    });
    for (const scope of scopes) {
      const key = String(scope.couponId);
      map.set(key, [...(map.get(key) ?? []), String(scope.targetId)]);
    }
    return map;
  }

  private async get(id: string) {
    const coupon = await this.couponRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!coupon) throw this.userError("优惠券不存在");
    return coupon;
  }

  private async expireCoupons(memberId?: string) {
    const params: Array<string | number> = [MemberCouponStatus.EXPIRED, MemberCouponStatus.UNUSED];
    let memberFilter = "";
    if (memberId) {
      memberFilter = " AND mc.member_id = ?";
      params.push(memberId);
    }
    await this.dataSource.query(
      `UPDATE member_coupon mc
       INNER JOIN coupon c ON c.id = mc.coupon_id
       SET mc.status = ?
       WHERE mc.status = ? AND mc.is_deleted = 0 AND c.valid_end < NOW()${memberFilter}`,
      params
    );
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
