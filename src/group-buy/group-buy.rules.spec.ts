import { GroupBuyStatus } from "./group-buy.constants";
import { groupExpireTime, hasGroupCapacity, resolveFormingStatus } from "./group-buy.rules";

describe("group-buy rules", () => {
  it("团截止时间不超过活动结束时间", () => {
    const start = new Date("2026-08-18T10:00:00Z");
    expect(groupExpireTime(start, 120, new Date("2026-08-18T11:00:00Z"))).toEqual(
      new Date("2026-08-18T11:00:00Z")
    );
  });

  it("占位达到人数上限后不再接收成员", () => {
    expect(hasGroupCapacity(1, 2)).toBe(true);
    expect(hasGroupCapacity(2, 2)).toBe(false);
  });

  it("到期优先失败，未到期且付款达标才成团", () => {
    const expire = new Date("2026-08-18T12:00:00Z");
    expect(resolveFormingStatus(new Date("2026-08-18T12:00:00Z"), expire, 2, 2)).toBe(
      GroupBuyStatus.FAILED
    );
    expect(resolveFormingStatus(new Date("2026-08-18T11:59:00Z"), expire, 2, 2)).toBe(
      GroupBuyStatus.SUCCESS
    );
  });
});
