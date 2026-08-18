import { GroupBuyStatus } from "./group-buy.constants";

export function groupExpireTime(start: Date, durationMinutes: number, activityEnd: Date): Date {
  return new Date(Math.min(start.getTime() + durationMinutes * 60_000, activityEnd.getTime()));
}

export function hasGroupCapacity(occupiedPeople: number, requiredPeople: number): boolean {
  return occupiedPeople < requiredPeople;
}

export function resolveFormingStatus(
  now: Date,
  expireTime: Date,
  paidPeople: number,
  requiredPeople: number
): number {
  if (now >= expireTime) return GroupBuyStatus.FAILED;
  if (paidPeople >= requiredPeople) return GroupBuyStatus.SUCCESS;
  return GroupBuyStatus.FORMING;
}
