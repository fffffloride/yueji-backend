export const AgentStatus = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  DISABLED: 3,
} as const;

export const CommissionStatus = {
  WAIT_VERIFY: 0,
  WAIT_SETTLEMENT: 1,
  REVERSED: 2,
  SETTLED: 3,
} as const;

export const SettlementCycle = {
  WEEK: "WEEK",
  MONTH: "MONTH",
  QUARTER: "QUARTER",
  YEAR: "YEAR",
} as const;

export type SettlementCycleType = (typeof SettlementCycle)[keyof typeof SettlementCycle];

export const WithdrawalMode = { APPLY: "APPLY", AUTO: "AUTO" } as const;

export const WithdrawalStatus = {
  PENDING_REVIEW: 0,
  PENDING_PAYMENT: 1,
  REJECTED: 2,
  PAID: 3,
} as const;

export const DistributionProfitPoint = { PRODUCT_SALES: "PRODUCT_SALES" } as const;

export const DirectSalesStatus = {
  PENDING: 0,
  APPLIED: 1,
  REVERSED: 2,
} as const;

export const ConfigStatus = { DISABLED: 0, ENABLED: 1 } as const;
