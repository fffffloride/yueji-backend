import { fillAnalyticsTrend, normalizeAnalyticsRange } from "./distribution-analytics.rules";

describe("distribution analytics rules", () => {
  it("selects granularity, validates ranges and fills missing periods", () => {
    expect(normalizeAnalyticsRange("2026-08-01", "2026-08-31").granularity).toBe("DAY");
    expect(normalizeAnalyticsRange("2026-08-01", "2026-09-01").granularity).toBe("MONTH");
    expect(normalizeAnalyticsRange("2025-08-25", "2026-08-25").granularity).toBe("MONTH");
    expect(normalizeAnalyticsRange("2025-08-24", "2026-08-25").granularity).toBe("YEAR");
    expect(() => normalizeAnalyticsRange("2026-08-02", "2026-08-01")).toThrow(
      "开始日期不能晚于结束日期"
    );
    expect(() => normalizeAnalyticsRange("2026-08-01", undefined)).toThrow(
      "开始日期和结束日期必须同时填写"
    );
    expect(() => normalizeAnalyticsRange("2020-01-01", "2025-01-02")).toThrow(
      "查询时间跨度不能超过5年"
    );

    expect(
      fillAnalyticsTrend(
        ["2026-08-01", "2026-08-02"],
        [{ period: "2026-08-02", totalSalesAmount: "1200", verifiedOrderCount: "2" }],
        [{ period: "2026-08-01", distributionSalesAmount: "500" }]
      )
    ).toEqual([
      {
        period: "2026-08-01",
        totalSalesAmount: 0,
        verifiedOrderCount: 0,
        distributionSalesAmount: 500,
      },
      {
        period: "2026-08-02",
        totalSalesAmount: 1200,
        verifiedOrderCount: 2,
        distributionSalesAmount: 0,
      },
    ]);
  });
});
