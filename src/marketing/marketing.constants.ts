export enum CouponType {
  FULL_REDUCTION = "FULL_REDUCTION",
  DISCOUNT = "DISCOUNT",
  EXCHANGE = "EXCHANGE",
  NEW_USER = "NEW_USER",
}

export function isFullReductionLike(type: CouponType) {
  return type === CouponType.FULL_REDUCTION || type === CouponType.NEW_USER;
}

/** 新人券不按领取窗/有效期控制，库内仍写固定时间以满足非空约束。 */
export function isOpenEndedCoupon(type: CouponType) {
  return type === CouponType.NEW_USER;
}

export const OPEN_ENDED_COUPON_START = "2020-01-01T00:00:00.000Z";
export const OPEN_ENDED_COUPON_END = "2099-12-31T23:59:59.000Z";

export enum CouponScopeType {
  ALL = "ALL",
  CATEGORY = "CATEGORY",
  PRODUCT = "PRODUCT",
}

export enum CouponTemplateStatus {
  DRAFT = 0,
  ACTIVE = 1,
  DISABLED = 2,
}

export enum MemberCouponStatus {
  UNUSED = 0,
  LOCKED = 1,
  USED = 2,
  EXPIRED = 3,
}

export enum PointsBizType {
  INIT = "INIT",
  ORDER_DEDUCT = "ORDER_DEDUCT",
  ORDER_CANCEL_RETURN = "ORDER_CANCEL_RETURN",
  ORDER_REFUND_RETURN = "ORDER_REFUND_RETURN",
  ORDER_EARN = "ORDER_EARN",
}

export interface PointsRule {
  earnPerYuan: number;
  redeemPointsPerYuan: number;
  maxDeductRate: number;
}

export const POINTS_RULE_LIMITS = {
  maxEarnPerYuan: 10_000,
  maxRedeemPointsPerYuan: 1_000_000,
} as const;

export const MAX_COUPON_SCOPE_IDS = 500;
export const MAX_COUPON_ISSUE_MEMBERS = 500;

export const DEFAULT_POINTS_RULE: PointsRule = {
  earnPerYuan: 1,
  redeemPointsPerYuan: 100,
  maxDeductRate: 5000,
};
