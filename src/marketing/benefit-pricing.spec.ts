import {
  calculateCouponAmount,
  calculatePointsDeduction,
  categoryInScope,
  discountUnitPrice,
} from "./benefit-pricing";
import { CouponType } from "./marketing.constants";

describe("阶段5权益计价", () => {
  it("逐行会员折扣向下取整", () => {
    expect(discountUnitPrice(199, 8500)).toBe(169);
  });

  it("计算满减券和折扣封顶", () => {
    expect(calculateCouponAmount(CouponType.FULL_REDUCTION, 10000, 8000, 1000, 10000)).toBe(1000);
    expect(calculateCouponAmount(CouponType.FULL_REDUCTION, 7000, 8000, 1000, 10000)).toBe(0);
    expect(calculateCouponAmount(CouponType.DISCOUNT, 10000, 0, 0, 8000, 1500)).toBe(1500);
  });

  it("兑换券抵扣一件折后SKU金额", () => {
    expect(calculateCouponAmount(CouponType.EXCHANGE, 8500, 0, 0, 10000)).toBe(8500);
  });

  it("积分按整百兑换且最多抵扣50%", () => {
    expect(
      calculatePointsDeduction(1099, 1000, 999, {
        earnPerYuan: 1,
        redeemPointsPerYuan: 100,
        maxDeductRate: 5000,
      })
    ).toEqual({ pointsUsed: 500, pointsDeduct: 500, maxUsablePoints: 500 });
    expect(
      calculatePointsDeduction(1000, 150, 150, {
        earnPerYuan: 1,
        redeemPointsPerYuan: 100,
        maxDeductRate: 5000,
      })
    ).toEqual({ pointsUsed: 100, pointsDeduct: 100, maxUsablePoints: 100 });
  });

  it("分类范围包含子分类", () => {
    expect(categoryInScope("30", "0,10,20", new Set(["10"]))).toBe(true);
    expect(categoryInScope("30", "0,20", new Set(["10"]))).toBe(false);
  });
});
