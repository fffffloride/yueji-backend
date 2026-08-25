import { fillTrafficTrend, growthRate, shanghaiDate } from "./dashboard.service";

describe("dashboard statistics", () => {
  it("calculates growth and fills missing traffic days", () => {
    expect(growthRate(15, 10)).toBe(0.5);
    expect(growthRate(0, 0)).toBeNull();
    expect(
      fillTrafficTrend(["2026-08-24", "2026-08-25"], [{ date: "2026-08-25", uv: "2", pv: "5" }])
    ).toEqual({ uvList: [0, 2], pvList: [0, 5] });
    expect(shanghaiDate(0, new Date("2026-08-24T16:30:00Z"))).toBe("2026-08-25");
  });
});
