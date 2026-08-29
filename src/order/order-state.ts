import { OrderStatus } from "./order-status";

/** 允许的状态流转。待付款可支付或取消；支付后可核销或整单退款；核销完成后不可退款。 */
const ALLOWED: Record<number, number[]> = {
  [OrderStatus.UNPAID]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.VERIFIED, OrderStatus.REFUNDED],
  [OrderStatus.VERIFIED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  // 渠道成功通知晚于超时取消时，原路退款完成后可进入已退款；库存与权益不得再次回补。
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

export function canTransition(from: number, to: number): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: number, to: number): void {
  if (!canTransition(from, to)) {
    throw new Error(`非法订单状态流转: ${from} -> ${to}`);
  }
}
