export const AgentStatus = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  DISABLED: 3,
} as const;

export const CommissionStatus = {
  PENDING: 0,
  AVAILABLE: 1,
  REVERSED: 2,
} as const;

export const DirectSalesStatus = {
  PENDING: 0,
  APPLIED: 1,
  REVERSED: 2,
} as const;

export const ConfigStatus = { DISABLED: 0, ENABLED: 1 } as const;
