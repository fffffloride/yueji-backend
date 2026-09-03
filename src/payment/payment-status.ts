export const PaymentStatus = {
  PENDING: 0,
  SUCCESS: 1,
  FAILED: 2,
  REFUNDED: 3,
} as const;

export const RefundStatus = {
  PROCESSING: 0,
  SUCCESS: 1,
  FAILED: 2,
  /** 微信退款处理中超 7 天且余额不足；必须换新商户退款单号重申。 */
  CLOSED: 3,
  /** 微信退款异常；禁止同号重申，只能持续查单并人工/异常退款处理。 */
  ABNORMAL: 4,
} as const;

/** 退款已受理但尚未安全结束时，阻断主支付对应订单继续履约。 */
export const REFUND_FULFILLMENT_BLOCKING_STATUSES: number[] = [
  RefundStatus.PROCESSING,
  RefundStatus.CLOSED,
  RefundStatus.ABNORMAL,
];

/** 预留下单及调起支付所需的最短剩余付款时间。 */
export const MIN_PAYMENT_REMAINING_MS = 60_000;
