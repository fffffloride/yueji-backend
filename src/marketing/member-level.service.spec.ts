import { MemberLevelService } from "./member-level.service";
import { Member } from "@/member/entities/member.entity";
import { MemberLevel } from "./entities/member-level.entity";

describe("MemberLevelService", () => {
  it("数据库活动门槛唯一键冲突时返回业务错误", async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockRejectedValue({ code: "ER_DUP_ENTRY" }),
    };
    const service = new MemberLevelService(repository as never, {} as never);

    await expect(
      service.create({
        name: "金卡",
        thresholdAmount: 10000,
        discountRate: 9000,
        status: 1,
        sort: 1,
      })
    ).rejects.toMatchObject({ response: { msg: "累计实付门槛不能重复" } });
  });

  it("删除等级时锁行并在同一事务复查会员引用", async () => {
    const level = { id: "1", isDeleted: 0 };
    const manager = {
      findOne: jest.fn().mockResolvedValue(level),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(async (value) => value),
    };
    const dataSource = { transaction: jest.fn((work) => work(manager)) };
    const service = new MemberLevelService({} as never, dataSource as never);

    await expect(service.remove("1")).resolves.toBe(true);
    expect(manager.findOne).toHaveBeenCalledWith(MemberLevel, {
      where: { id: "1", isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    expect(manager.count).toHaveBeenCalledWith(Member, {
      where: { levelId: "1", isDeleted: 0 },
    });
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1 }));
  });
});
