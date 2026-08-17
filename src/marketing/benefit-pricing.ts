import { CouponType, type PointsRule } from "./marketing.constants";

export function discountUnitPrice(price: number, discountRate: number): number {
  return Math.floor((price * discountRate) / 10000);
}

export function calculateCouponAmount(
  type: CouponType,
  eligibleAmount: number,
  thresholdAmount: number,
  discountAmount: number,
  discountRate: number,
  maxDiscountAmount?: number | null
): number {
  if (eligibleAmount < thresholdAmount) return 0;
  if (type === CouponType.FULL_REDUCTION) return Math.min(discountAmount, eligibleAmount);
  if (type === CouponType.DISCOUNT) {
    const raw = eligibleAmount - Math.floor((eligibleAmount * discountRate) / 10000);
    return maxDiscountAmount ? Math.min(raw, maxDiscountAmount) : raw;
  }
  return eligibleAmount;
}

export function calculatePointsDeduction(
  remainingAmount: number,
  balance: number,
  requested: number,
  rule: PointsRule
) {
  const maxDeductFen = Math.floor((remainingAmount * rule.maxDeductRate) / 10000);
  const maxUsablePoints = Math.floor(maxDeductFen / 100) * rule.redeemPointsPerYuan;
  const availableBalance =
    Math.floor(Math.max(0, balance) / rule.redeemPointsPerYuan) * rule.redeemPointsPerYuan;
  const normalizedRequest =
    Math.floor(Math.max(0, requested) / rule.redeemPointsPerYuan) * rule.redeemPointsPerYuan;
  const pointsUsed = Math.min(availableBalance, normalizedRequest, maxUsablePoints);
  return {
    pointsUsed,
    pointsDeduct: Math.floor(pointsUsed / rule.redeemPointsPerYuan) * 100,
    maxUsablePoints: Math.min(availableBalance, maxUsablePoints),
  };
}

export function categoryInScope(categoryId: string, treePath: string, targets: Set<string>) {
  return targets.has(categoryId) || treePath.split(",").some((id) => targets.has(id));
}
