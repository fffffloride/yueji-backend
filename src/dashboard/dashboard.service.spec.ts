import type { DataSource } from "typeorm";

import { DashboardService, fillTrafficTrend, growthRate, shanghaiDate } from "./dashboard.service";

describe("dashboard statistics", () => {
  it("calculates growth and fills missing traffic days", () => {
    expect(growthRate(15, 10)).toBe(0.5);
    expect(growthRate(0, 0)).toBeNull();
    expect(
      fillTrafficTrend(["2026-08-24", "2026-08-25"], [{ date: "2026-08-25", uv: "2", pv: "5" }])
    ).toEqual({ uvList: [0, 2], pvList: [0, 5] });
    expect(shanghaiDate(0, new Date("2026-08-24T16:30:00Z"))).toBe("2026-08-25");
  });

  it("includes closed and abnormal refunds in attention queries", async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new DashboardService({ query } as unknown as DataSource);

    await service.getOverview(7);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("status IN (2,3,4)");
    expect(sql).toContain("WHEN 3 THEN '关闭待重试'");
    expect(sql).toContain("WHEN 4 THEN '异常待人工'");
    expect(sql).toContain("WHEN 3 THEN 'refund_closed'");
    expect(sql).toContain("ELSE 'refund_abnormal'");
  });
});
