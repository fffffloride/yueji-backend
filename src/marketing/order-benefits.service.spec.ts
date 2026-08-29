import { OrderBenefitsService } from "./order-benefits.service";
import {
  CouponScopeType,
  CouponTemplateStatus,
  CouponType,
  MemberCouponStatus,
} from "./marketing.constants";
import { Coupon } from "./entities/coupon.entity";
import { CouponScope } from "./entities/coupon-scope.entity";
import { MemberCoupon } from "./entities/member-coupon.entity";
import { MemberLevel } from "./entities/member-level.entity";
import { Member } from "@/member/entities/member.entity";
import { ProductCategory } from "@/product/entities/product-category.entity";

describe("OrderBenefitsService availableCoupons", () => {
  it("批量读取券模板与范围并保持原计价规则", async () => {
    const now = Date.now();
    const memberCoupons = [
      { id: "mc1", couponId: "c1", memberId: "1", status: MemberCouponStatus.UNUSED },
      { id: "mc2", couponId: "c2", memberId: "1", status: MemberCouponStatus.UNUSED },
    ];
    const coupons = [
      {
        id: "c1",
        name: "满减券",
        type: CouponType.FULL_REDUCTION,
        scopeType: CouponScopeType.ALL,
        thresholdAmount: 5000,
        discountAmount: 1000,
        discountRate: 10000,
        maxDiscountAmount: null,
        validStart: new Date(now - 1000),
        validEnd: new Date(now + 60_000),
        status: CouponTemplateStatus.ACTIVE,
      },
      {
        id: "c2",
        name: "商品八折券",
        type: CouponType.DISCOUNT,
        scopeType: CouponScopeType.PRODUCT,
        thresholdAmount: 0,
        discountAmount: 0,
        discountRate: 8000,
        maxDiscountAmount: null,
        validStart: new Date(now - 1000),
        validEnd: new Date(now + 60_000),
        status: CouponTemplateStatus.ACTIVE,
      },
    ];
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === Member) {
          return { id: "1", status: 1, levelId: null, totalSpent: 0, points: 0 };
        }
        if (entity === MemberLevel) return { id: "l1", discountRate: 10000 };
        return null;
      }),
      find: jest.fn(async (entity) => {
        if (entity === MemberCoupon) return memberCoupons;
        if (entity === Coupon) return coupons;
        if (entity === CouponScope) {
          return [{ couponId: "c2", targetType: CouponScopeType.PRODUCT, targetId: "p1" }];
        }
        if (entity === ProductCategory) return [];
        return [];
      }),
    };
    const service = new OrderBenefitsService({} as never);

    const result = await service.availableCoupons(manager as never, "1", [
      { skuId: "s1", productId: "p1", categoryId: "cat1", price: 10000, quantity: 1 },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ memberCouponId: "mc2", couponAmount: 2000 }),
      expect.objectContaining({ memberCouponId: "mc1", couponAmount: 1000 }),
    ]);
    expect(manager.find).toHaveBeenCalledTimes(4);
  });
});
