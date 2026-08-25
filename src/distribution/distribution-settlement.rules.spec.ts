import { SettlementCycle } from "./distribution.constants";
import {
  accountAmounts,
  latestDuePeriod,
  nextSettlementDate,
  periodContaining,
} from "./distribution-settlement.rules";

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

describe("distribution settlement rules", () => {
  it.each([
    [SettlementCycle.WEEK, 2, "2026-08-17", "2026-08-23", "2026-09-01"],
    [SettlementCycle.MONTH, 15, "2026-07-01", "2026-07-31", "2026-09-15"],
    [SettlementCycle.QUARTER, 10, "2026-04-01", "2026-06-30", "2026-10-10"],
    [SettlementCycle.YEAR, 8, "2025-01-01", "2025-12-31", "2027-01-08"],
  ])("计算 %s 上一完整周期", (cycle, day, start, end, next) => {
    const now = new Date(2026, 7, 25, 12);
    const period = latestDuePeriod(cycle, day, now)!;
    expect(ymd(period.periodStart)).toBe(start);
    expect(ymd(period.periodEnd)).toBe(end);
    expect(ymd(nextSettlementDate(cycle, day, now))).toBe(next);
  });

  it("自然周从周一到周日", () => {
    const period = periodContaining(SettlementCycle.WEEK, new Date(2026, 7, 23));
    expect(ymd(period.periodStart)).toBe("2026-08-17");
    expect(ymd(period.periodEnd)).toBe("2026-08-23");
  });

  it("冻结提现金额并在驳回后释放", () => {
    expect(accountAmounts(100_000, 20_000, 30_000, 10_000, 15_000)).toEqual({
      settledTotal: 100_000,
      frozenAmount: 50_000,
      rejectedAmount: 10_000,
      paidAmount: 15_000,
      availableAmount: 35_000,
    });
  });
});
