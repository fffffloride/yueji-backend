import {
  DistributionTaskDisplayStatus,
  DistributionTaskMetric,
  DistributionTaskStatus,
} from "./distribution.constants";

export function taskDisplayStatus(
  status: number,
  startTime: Date,
  endTime: Date,
  now = new Date()
) {
  if (status === DistributionTaskStatus.DRAFT) return DistributionTaskDisplayStatus.DRAFT;
  if (status === DistributionTaskStatus.CANCELLED) return DistributionTaskDisplayStatus.CANCELLED;
  if (now < startTime) return DistributionTaskDisplayStatus.NOT_STARTED;
  if (now > endTime) return DistributionTaskDisplayStatus.FINISHED;
  return DistributionTaskDisplayStatus.IN_PROGRESS;
}

export function taskProgress(
  metricType: string,
  targetValue: number,
  salesAmount: number,
  orderCount: number
) {
  const currentValue =
    metricType === DistributionTaskMetric.SALES_AMOUNT ? salesAmount : orderCount;
  return {
    currentValue,
    completed: currentValue >= targetValue,
    progressRateBps: Math.min(10_000, Math.floor((currentValue * 10_000) / targetValue)),
  };
}
