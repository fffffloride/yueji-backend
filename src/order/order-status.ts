/** 订单状态(0-待付款 1-已付款/待核销 2-已核销 3-已完成 4-已取消) */
export const OrderStatus = {
  UNPAID: 0,
  PAID: 1,
  VERIFIED: 2,
  COMPLETED: 3,
  CANCELLED: 4,
} as const;

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_LABEL: Record<number, string> = {
  [OrderStatus.UNPAID]: "待付款",
  [OrderStatus.PAID]: "待核销",
  [OrderStatus.VERIFIED]: "已核销",
  [OrderStatus.COMPLETED]: "已完成",
  [OrderStatus.CANCELLED]: "已取消",
};
