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
} as const;
