export interface PricingLine {
  /** 单价(分) */
  price: number;
  quantity: number;
}

export interface PricingContext {
  /** 会员折扣(分)，阶段5接入，本阶段为 0 */
  memberDiscount?: number;
  /** 优惠券抵扣(分)，阶段5接入 */
  couponAmount?: number;
  /** 积分抵扣(分)，阶段5接入 */
  pointsDeduct?: number;
}

export interface PricingResult {
  totalAmount: number;
  memberDiscount: number;
  couponAmount: number;
  pointsDeduct: number;
  discountAmount: number;
  payAmount: number;
}

/**
 * 计价管道：商品总额 → 会员折扣 → 优惠券 → 积分抵扣 → 实付。
 * 阶段3后三步固定为 0，接口形状先定死，阶段5只往这里填数。
 */
export function calcPricing(lines: PricingLine[], ctx: PricingContext = {}): PricingResult {
  const totalAmount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const memberDiscount = Math.max(0, ctx.memberDiscount ?? 0);
  const couponAmount = Math.max(0, ctx.couponAmount ?? 0);
  const pointsDeduct = Math.max(0, ctx.pointsDeduct ?? 0);
  const discountAmount = memberDiscount + couponAmount + pointsDeduct;
  const payAmount = Math.max(0, totalAmount - discountAmount);
  return {
    totalAmount,
    memberDiscount,
    couponAmount,
    pointsDeduct,
    discountAmount,
    payAmount,
  };
}
