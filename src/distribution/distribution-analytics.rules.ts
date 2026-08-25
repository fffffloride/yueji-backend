const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 1827;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AnalyticsGranularity = "DAY" | "MONTH" | "YEAR";

export type AnalyticsRange = {
  startDate: string;
  endDate: string;
  startTime: string;
  endExclusive: string;
  granularity: AnalyticsGranularity;
  periods: string[];
};

export type AnalyticsTrend = {
  period: string;
  totalSalesAmount: number;
  verifiedOrderCount: number;
  distributionSalesAmount: number;
};

export function normalizeAnalyticsRange(
  startDate?: string,
  endDate?: string,
  now = new Date()
): AnalyticsRange {
  if (Boolean(startDate) !== Boolean(endDate)) throw new Error("开始日期和结束日期必须同时填写");
  const today = shanghaiDate(now);
  const start = startDate ?? `${today.slice(0, 7)}-01`;
  const end = endDate ?? today;
  const startTime = parseShanghaiDate(start);
  const endTime = parseShanghaiDate(end);
  if (startTime > endTime) throw new Error("开始日期不能晚于结束日期");
  const days = Math.floor((endTime.getTime() - startTime.getTime()) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) throw new Error("查询时间跨度不能超过5年");
  const granularity: AnalyticsGranularity = days <= 31 ? "DAY" : days <= 366 ? "MONTH" : "YEAR";
  return {
    startDate: start,
    endDate: end,
    startTime: `${start} 00:00:00`,
    endExclusive: `${shanghaiDate(new Date(endTime.getTime() + DAY_MS))} 00:00:00`,
    granularity,
    periods: buildPeriods(start, end, granularity),
  };
}

export function fillAnalyticsTrend(
  periods: string[],
  systemRows: Array<{
    period: string;
    totalSalesAmount: string | number;
    verifiedOrderCount: string | number;
  }>,
  distributionRows: Array<{ period: string; distributionSalesAmount: string | number }>
): AnalyticsTrend[] {
  const system = new Map(systemRows.map((row) => [row.period, row]));
  const distribution = new Map(distributionRows.map((row) => [row.period, row]));
  return periods.map((period) => ({
    period,
    totalSalesAmount: Number(system.get(period)?.totalSalesAmount ?? 0),
    verifiedOrderCount: Number(system.get(period)?.verifiedOrderCount ?? 0),
    distributionSalesAmount: Number(distribution.get(period)?.distributionSalesAmount ?? 0),
  }));
}

export function periodSql(column: string, granularity: AnalyticsGranularity) {
  const format = granularity === "DAY" ? "%Y-%m-%d" : granularity === "MONTH" ? "%Y-%m" : "%Y";
  return `DATE_FORMAT(${column}, '${format}')`;
}

function buildPeriods(startDate: string, endDate: string, granularity: AnalyticsGranularity) {
  if (granularity === "MONTH") {
    const periods: string[] = [];
    let year = Number(startDate.slice(0, 4));
    let month = Number(startDate.slice(5, 7));
    const endKey = endDate.slice(0, 7);
    while (`${year}-${String(month).padStart(2, "0")}` <= endKey) {
      periods.push(`${year}-${String(month).padStart(2, "0")}`);
      if (++month === 13) {
        year++;
        month = 1;
      }
    }
    return periods;
  }
  if (granularity === "YEAR") {
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(endDate.slice(0, 4));
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => String(startYear + index));
  }
  const periods: string[] = [];
  const end = parseShanghaiDate(endDate);
  let cursor = parseShanghaiDate(startDate);
  while (cursor <= end) {
    const date = shanghaiDate(cursor);
    periods.push(date);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return periods;
}

function parseShanghaiDate(value: string) {
  if (!DATE_PATTERN.test(value)) throw new Error("日期格式必须为YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime()) || shanghaiDate(date) !== value) throw new Error("日期无效");
  return date;
}

function shanghaiDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
