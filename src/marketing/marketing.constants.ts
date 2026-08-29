export enum CouponType {
  FULL_REDUCTION = "FULL_REDUCTION",
  DISCOUNT = "DISCOUNT",
  EXCHANGE = "EXCHANGE",
}

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
