export const OrderGiftStatus = {
  PENDING: 0,
  CLAIMED: 1,
  REVOKED: 2,
  EXPIRED: 3,
  RETURNED: 4,
} as const;

export type OrderGiftStatusValue = (typeof OrderGiftStatus)[keyof typeof OrderGiftStatus];

export const ORDER_GIFT_STATUS_LABEL: Record<number, string> = {
  [OrderGiftStatus.PENDING]: "待领取",
  [OrderGiftStatus.CLAIMED]: "已领取",
  [OrderGiftStatus.REVOKED]: "已撤回",
  [OrderGiftStatus.EXPIRED]: "已过期",
  [OrderGiftStatus.RETURNED]: "已退回",
};

export const OrderGiftDirection = {
  SENT: "SENT",
  RECEIVED: "RECEIVED",
} as const;

export type OrderGiftDirectionValue = (typeof OrderGiftDirection)[keyof typeof OrderGiftDirection];

export const OrderViewerRole = {
  PURCHASER: "PURCHASER",
  BENEFICIARY: "BENEFICIARY",
} as const;
