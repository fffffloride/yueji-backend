import { Injectable } from "@nestjs/common";
import { EntityManager, In, LessThanOrEqual } from "typeorm";

import {
  CouponScopeType,
  CouponTemplateStatus,
  CouponType,
  MemberCouponStatus,
  PointsBizType,
} from "./marketing.constants";
import { Coupon } from "./entities/coupon.entity";
import { CouponScope } from "./entities/coupon-scope.entity";
import { MemberCoupon } from "./entities/member-coupon.entity";
import { MemberLevel } from "./entities/member-level.entity";
import { MemberPointsLog } from "./entities/member-points-log.entity";
import { PointsService } from "./points.service";
import {
  calculateCouponAmount,
  calculatePointsDeduction,
  categoryInScope,
  discountUnitPrice,
} from "./benefit-pricing";
import { Member } from "@/member/entities/member.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { ProductCategory } from "@/product/entities/product-category.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { resolveEffectiveMemberLevel } from "./member-level-resolver";

export interface BenefitLine {
  skuId: string;
  productId: string;
  categoryId: string;
  price: number;
  quantity: number;
}

export interface OrderBenefitQuote {
  totalAmount: number;
  memberLevelId: string | null;
  memberLevelName: string | null;
  memberDiscount: number;
  memberCouponId: string | null;
  couponName: string | null;
  couponType: CouponType | null;
  couponAmount: number;
  pointsUsed: number;
  pointsDeduct: number;
  maxUsablePoints: number;
  discountAmount: number;
  payAmount: number;
}

@Injectable()
export class OrderBenefitsService {
  constructor(private readonly pointsService: PointsService) {}

  async quote(
    manager: EntityManager,
    memberId: string,
    lines: BenefitLine[],
    memberCouponId?: string,
    pointsToUse = 0,
    lock = false
  ): Promise<OrderBenefitQuote> {
    const member = await manager.findOne(Member, {
      where: { id: memberId, isDeleted: 0 },
      ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
    });
    if (!member || member.status !== 1) throw this.userError("会员不可用");

    const level = await resolveEffectiveMemberLevel(manager, member);
    const memberRate = level?.discountRate ?? 10000;
    const totalAmount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const discountedLines = lines.map((line) => ({
      ...line,
      discountedUnitPrice: discountUnitPrice(line.price, memberRate),
    }));
    const afterMember = discountedLines.reduce(
      (sum, line) => sum + line.discountedUnitPrice * line.quantity,
      0
    );
    const memberDiscount = totalAmount - afterMember;

    let memberCoupon: MemberCoupon | null = null;
    let coupon: Coupon | null = null;
    let couponAmount = 0;
    if (memberCouponId) {
      ({ memberCoupon, coupon } = await this.resolveCoupon(
        manager,
        memberId,
        memberCouponId,
        lock
      ));
      couponAmount = await this.calculateCoupon(manager, coupon, discountedLines);
      couponAmount = Math.min(couponAmount, afterMember);
      if (couponAmount <= 0) throw this.userError("优惠券不适用于当前商品");
    }

    const afterCoupon = Math.max(0, afterMember - couponAmount);
    const rule = await this.pointsService.getRule();
    const { pointsUsed, pointsDeduct, maxUsablePoints } = calculatePointsDeduction(
      afterCoupon,
      member.points,
      pointsToUse,
      rule
    );
    const discountAmount = memberDiscount + couponAmount + pointsDeduct;

    return {
      totalAmount,
      memberLevelId: level?.id ?? null,
      memberLevelName: level?.name ?? null,
      memberDiscount,
      memberCouponId: memberCoupon?.id ?? null,
      couponName: coupon?.name ?? null,
      couponType: coupon?.type ?? null,
      couponAmount,
      pointsUsed,
      pointsDeduct,
      maxUsablePoints,
      discountAmount,
      payAmount: Math.max(0, totalAmount - discountAmount),
    };
  }

  async availableCoupons(manager: EntityManager, memberId: string, lines: BenefitLine[]) {
    const rows = await manager.find(MemberCoupon, {
      where: { memberId, status: MemberCouponStatus.UNUSED, isDeleted: 0 },
      order: { createTime: "DESC" },
    });
    const available: Array<{
      memberCouponId: string;
      couponId: string;
      couponName: string | null;
      couponType: CouponType | null;
      couponAmount: number;
      thresholdAmount: number;
      validEnd: Date | null;
    }> = [];
    for (const row of rows) {
      try {
        const quote = await this.quote(manager, memberId, lines, row.id, 0);
        const coupon = await manager.findOne(Coupon, { where: { id: row.couponId } });
        available.push({
          memberCouponId: row.id,
          couponId: row.couponId,
          couponName: quote.couponName,
          couponType: quote.couponType,
          couponAmount: quote.couponAmount,
          thresholdAmount: coupon?.thresholdAmount ?? 0,
          validEnd: coupon?.validEnd ?? null,
        });
      } catch {
        // Invalid or inapplicable coupons are omitted from the available list.
      }
    }
    return available.sort((a, b) => b.couponAmount - a.couponAmount);
  }

  async reserveOrder(manager: EntityManager, order: BizOrder) {
    if (order.pointsUsed > 0) {
      await this.pointsService.adjust(
        manager,
        order.memberId,
        -order.pointsUsed,
        PointsBizType.ORDER_DEDUCT,
        order.id,
        order.id,
        `订单 ${order.orderNo} 使用积分`
      );
    }
    if (order.memberCouponId) {
      const memberCoupon = await manager.findOne(MemberCoupon, {
        where: {
          id: order.memberCouponId,
          memberId: order.memberId,
          status: MemberCouponStatus.UNUSED,
          isDeleted: 0,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!memberCoupon) throw this.userError("优惠券不可用");
      memberCoupon.status = MemberCouponStatus.LOCKED;
      memberCoupon.orderId = order.id;
      await manager.save(memberCoupon);
    }
  }

  async markPaid(manager: EntityManager, order: BizOrder) {
    if (!order.memberCouponId) return;
    const memberCoupon = await manager.findOne(MemberCoupon, {
      where: { id: order.memberCouponId, orderId: order.id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!memberCoupon || memberCoupon.status === MemberCouponStatus.USED) return;
    if (memberCoupon.status !== MemberCouponStatus.LOCKED) throw this.userError("优惠券状态异常");
    memberCoupon.status = MemberCouponStatus.USED;
    memberCoupon.usedAt = new Date();
    await manager.save(memberCoupon);
  }

  async releaseOrder(
    manager: EntityManager,
    order: BizOrder,
    reason: PointsBizType.ORDER_CANCEL_RETURN | PointsBizType.ORDER_REFUND_RETURN
  ) {
    if (order.pointsUsed > 0) {
      await this.pointsService.adjust(
        manager,
        order.memberId,
        order.pointsUsed,
        reason,
        order.id,
        order.id,
        reason === PointsBizType.ORDER_REFUND_RETURN ? "订单退款返还积分" : "订单取消返还积分"
      );
    }
    if (!order.memberCouponId) return;
    const memberCoupon = await manager.findOne(MemberCoupon, {
      where: { id: order.memberCouponId, orderId: order.id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!memberCoupon || memberCoupon.status === MemberCouponStatus.UNUSED) return;
    const coupon = await manager.findOne(Coupon, {
      where: { id: memberCoupon.couponId, isDeleted: 0 },
    });
    memberCoupon.status =
      coupon && coupon.validEnd >= new Date()
        ? MemberCouponStatus.UNUSED
        : MemberCouponStatus.EXPIRED;
    memberCoupon.orderId = null;
    memberCoupon.usedAt = null;
    await manager.save(memberCoupon);
  }

  async completeOrder(manager: EntityManager, order: BizOrder) {
    const existing = await manager.findOne(MemberPointsLog, {
      where: {
        memberId: order.memberId,
        bizType: PointsBizType.ORDER_EARN,
        bizId: order.id,
        isDeleted: 0,
      },
    });
    if (existing) return;
    const member = await manager.findOne(Member, {
      where: { id: order.memberId, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!member) throw this.userError("会员不存在");
    const rule = await this.pointsService.getRule();
    const earned = Math.floor(order.payAmount / 100) * rule.earnPerYuan;
    member.totalSpent = (member.totalSpent ?? 0) + order.payAmount;
    member.points += earned;

    const currentLevel = member.levelId
      ? await manager.findOne(MemberLevel, {
          where: { id: member.levelId, status: 1, isDeleted: 0 },
        })
      : null;
    const nextLevel = await manager.findOne(MemberLevel, {
      where: {
        thresholdAmount: LessThanOrEqual(member.totalSpent),
        status: 1,
        isDeleted: 0,
      },
      order: { thresholdAmount: "DESC", sort: "ASC" },
    });
    if (nextLevel && (!currentLevel || nextLevel.thresholdAmount > currentLevel.thresholdAmount)) {
      member.levelId = nextLevel.id;
    }
    await manager.save(member);
    await manager.save(
      manager.create(MemberPointsLog, {
        memberId: member.id,
        changePoints: earned,
        balanceAfter: member.points,
        bizType: PointsBizType.ORDER_EARN,
        bizId: order.id,
        orderId: order.id,
        remark: `订单 ${order.orderNo} 完成赠送积分`,
        isDeleted: 0,
      })
    );
  }

  private async resolveCoupon(
    manager: EntityManager,
    memberId: string,
    memberCouponId: string,
    lock: boolean
  ) {
    const memberCoupon = await manager.findOne(MemberCoupon, {
      where: {
        id: memberCouponId,
        memberId,
        status: MemberCouponStatus.UNUSED,
        isDeleted: 0,
      },
      ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
    });
    if (!memberCoupon) throw this.userError("优惠券不可用");
    const coupon = await manager.findOne(Coupon, {
      where: {
        id: memberCoupon.couponId,
        status: CouponTemplateStatus.ACTIVE,
        isDeleted: 0,
      },
      ...(lock ? { lock: { mode: "pessimistic_read" as const } } : {}),
    });
    const now = new Date();
    if (!coupon || coupon.validStart > now || coupon.validEnd < now) {
      throw this.userError("优惠券不在有效期内");
    }
    return { memberCoupon, coupon };
  }

  private async calculateCoupon(
    manager: EntityManager,
    coupon: Coupon,
    lines: Array<BenefitLine & { discountedUnitPrice: number }>
  ) {
    if (coupon.type === CouponType.EXCHANGE) {
      const line = lines.find((item) => String(item.skuId) === String(coupon.exchangeSkuId));
      return line ? line.discountedUnitPrice : 0;
    }
    const applicable = await this.applicableLines(manager, coupon, lines);
    const eligibleAmount = applicable.reduce(
      (sum, line) => sum + line.discountedUnitPrice * line.quantity,
      0
    );
    if (eligibleAmount < coupon.thresholdAmount) return 0;
    if (coupon.type === CouponType.FULL_REDUCTION) {
      return calculateCouponAmount(
        coupon.type,
        eligibleAmount,
        coupon.thresholdAmount,
        coupon.discountAmount,
        coupon.discountRate,
        coupon.maxDiscountAmount
      );
    }
    return calculateCouponAmount(
      coupon.type,
      eligibleAmount,
      coupon.thresholdAmount,
      coupon.discountAmount,
      coupon.discountRate,
      coupon.maxDiscountAmount
    );
  }

  private async applicableLines(
    manager: EntityManager,
    coupon: Coupon,
    lines: Array<BenefitLine & { discountedUnitPrice: number }>
  ) {
    if (coupon.scopeType === CouponScopeType.ALL) return lines;
    const scopes = await manager.find(CouponScope, {
      where: { couponId: coupon.id, targetType: coupon.scopeType, isDeleted: 0 },
    });
    const targets = new Set(scopes.map((item) => String(item.targetId)));
    if (coupon.scopeType === CouponScopeType.PRODUCT) {
      return lines.filter((line) => targets.has(String(line.productId)));
    }
    const categoryIds = [...new Set(lines.map((line) => line.categoryId))];
    const categories = categoryIds.length
      ? await manager.find(ProductCategory, { where: { id: In(categoryIds), isDeleted: 0 } })
      : [];
    const categoryMap = new Map(categories.map((item) => [String(item.id), item]));
    return lines.filter((line) => {
      const category = categoryMap.get(String(line.categoryId));
      if (!category) return false;
      return categoryInScope(String(category.id), category.treePath, targets);
    });
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
