import { SettlementCycle, type SettlementCycleType } from "./distribution.constants";

export interface SettlementPeriod {
  periodStart: Date;
  periodEnd: Date;
}

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const dayEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0);
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function periodContaining(cycle: SettlementCycleType, date: Date): SettlementPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (cycle === SettlementCycle.WEEK) {
    const monday = addDays(date, -((date.getDay() + 6) % 7));
    return { periodStart: dayStart(monday), periodEnd: dayEnd(addDays(monday, 6)) };
  }
  if (cycle === SettlementCycle.MONTH) {
    return {
      periodStart: new Date(year, month, 1),
      periodEnd: dayEnd(new Date(year, month + 1, 0)),
    };
  }
  if (cycle === SettlementCycle.QUARTER) {
    const firstMonth = Math.floor(month / 3) * 3;
    return {
      periodStart: new Date(year, firstMonth, 1),
      periodEnd: dayEnd(new Date(year, firstMonth + 3, 0)),
    };
  }
  return {
    periodStart: new Date(year, 0, 1),
    periodEnd: dayEnd(new Date(year, 12, 0)),
  };
}

export function latestDuePeriod(
  cycle: SettlementCycleType,
  settlementDay: number,
  now = new Date()
): SettlementPeriod | null {
  const trigger = latestTrigger(cycle, settlementDay, now);
  if (trigger > now) return null;
  const currentPeriod = periodContaining(cycle, trigger);
  return periodContaining(cycle, addDays(currentPeriod.periodStart, -1));
}

export function nextSettlementDate(
  cycle: SettlementCycleType,
  settlementDay: number,
  now = new Date()
): Date {
  const latest = latestTrigger(cycle, settlementDay, now);
  if (latest > now) return latest;
  if (cycle === SettlementCycle.WEEK) return addDays(latest, 7);
  if (cycle === SettlementCycle.MONTH)
    return new Date(latest.getFullYear(), latest.getMonth() + 1, settlementDay);
  if (cycle === SettlementCycle.QUARTER)
    return new Date(latest.getFullYear(), latest.getMonth() + 3, settlementDay);
  return new Date(latest.getFullYear() + 1, 0, settlementDay);
}

function latestTrigger(cycle: SettlementCycleType, settlementDay: number, now: Date): Date {
  if (cycle === SettlementCycle.WEEK) {
    const weekday = ((now.getDay() + 6) % 7) + 1;
    return dayStart(addDays(now, -((weekday - settlementDay + 7) % 7)));
  }
  if (cycle === SettlementCycle.MONTH) {
    const current = new Date(now.getFullYear(), now.getMonth(), settlementDay);
    return current > now ? new Date(now.getFullYear(), now.getMonth() - 1, settlementDay) : current;
  }
  if (cycle === SettlementCycle.QUARTER) {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const current = new Date(now.getFullYear(), quarterMonth, settlementDay);
    return current > now ? new Date(now.getFullYear(), quarterMonth - 3, settlementDay) : current;
  }
  const current = new Date(now.getFullYear(), 0, settlementDay);
  return current > now ? new Date(now.getFullYear() - 1, 0, settlementDay) : current;
}

export function accountAmounts(
  settledTotal: number,
  pendingReview: number,
  pendingPayment: number,
  rejected: number,
  paid: number
) {
  const frozenAmount = pendingReview + pendingPayment;
  return {
    settledTotal,
    frozenAmount,
    rejectedAmount: rejected,
    paidAmount: paid,
    availableAmount: Math.max(0, settledTotal - frozenAmount - paid),
  };
}
