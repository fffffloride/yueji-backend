import {
  DistributionTaskDisplayStatus,
  DistributionTaskMetric,
  DistributionTaskStatus,
} from "./distribution.constants";
import { taskDisplayStatus, taskProgress } from "./distribution-task.rules";

describe("distribution task rules", () => {
  it("calculates lifecycle and both progress metrics", () => {
    const start = new Date("2026-08-25T01:00:00Z");
    const end = new Date("2026-08-25T03:00:00Z");
    expect(taskDisplayStatus(DistributionTaskStatus.DRAFT, start, end, start)).toBe(
      DistributionTaskDisplayStatus.DRAFT
    );
    expect(taskDisplayStatus(DistributionTaskStatus.PUBLISHED, start, end, start)).toBe(
      DistributionTaskDisplayStatus.IN_PROGRESS
    );
    expect(taskDisplayStatus(DistributionTaskStatus.PUBLISHED, start, end, new Date(0))).toBe(
      DistributionTaskDisplayStatus.NOT_STARTED
    );
    expect(
      taskDisplayStatus(DistributionTaskStatus.PUBLISHED, start, end, new Date("2026-08-26"))
    ).toBe(DistributionTaskDisplayStatus.FINISHED);
    expect(taskDisplayStatus(DistributionTaskStatus.CANCELLED, start, end, start)).toBe(
      DistributionTaskDisplayStatus.CANCELLED
    );
    expect(taskProgress(DistributionTaskMetric.SALES_AMOUNT, 10_000, 12_000, 1)).toEqual({
      currentValue: 12_000,
      completed: true,
      progressRateBps: 10_000,
    });
    expect(taskProgress(DistributionTaskMetric.ORDER_COUNT, 3, 99_999, 2)).toEqual({
      currentValue: 2,
      completed: false,
      progressRateBps: 6666,
    });
  });
});
