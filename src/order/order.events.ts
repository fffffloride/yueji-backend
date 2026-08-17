export const ORDER_EVENTS = {
  PAID: "order.paid",
  VERIFIED: "order.verified",
  COMPLETED: "order.completed",
  CANCELLED: "order.cancelled",
} as const;

export interface OrderEventPayload {
  orderId: string;
  orderNo: string;
  memberId: string;
}
