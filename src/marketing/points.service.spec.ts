import { PointsService } from "./points.service";
import { DEFAULT_POINTS_RULE } from "./marketing.constants";
import { Member } from "@/member/entities/member.entity";

describe("PointsService", () => {
  it("只从营销专属表读取有效积分规则", async () => {
    const ruleRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: "1",
        earnPerYuan: 2,
        redeemPointsPerYuan: 200,
        maxDeductRate: 3000,
        isDeleted: 0,
      }),
    };
    const service = new PointsService({} as never, ruleRepository as never);

    await expect(service.getRule()).resolves.toEqual({
      earnPerYuan: 2,
      redeemPointsPerYuan: 200,
      maxDeductRate: 3000,
    });
    expect(ruleRepository.findOne).toHaveBeenCalledWith({ where: { id: "1", isDeleted: 0 } });
  });

  it("数据库规则越界时回退安全默认值", async () => {
    const ruleRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: "1",
        earnPerYuan: 1,
        redeemPointsPerYuan: 0,
        maxDeductRate: 5000,
        isDeleted: 0,
      }),
    };
    const service = new PointsService({} as never, ruleRepository as never);

    await expect(service.getRule()).resolves.toEqual(DEFAULT_POINTS_RULE);
  });

  it("更新固定主键的营销积分规则且不依赖通用系统配置", async () => {
    const entity = { id: "1", isDeleted: 0 };
    const ruleRepository = {
      findOne: jest.fn().mockResolvedValue(entity),
      save: jest.fn(async (value) => value),
    };
    const service = new PointsService({} as never, ruleRepository as never);
    const dto = { earnPerYuan: 3, redeemPointsPerYuan: 300, maxDeductRate: 4000 };

    await expect(service.updateRule(dto)).resolves.toEqual(dto);
    expect(ruleRepository.save).toHaveBeenCalledWith({ ...entity, ...dto });
  });

  it("返回按门槛生成的等级编号、下一等级与最高等级状态", async () => {
    const member = { id: "1", levelId: "4", totalSpent: 60_000_000, points: 88 };
    const levels = [
      { id: "1", name: "普通会员", thresholdAmount: 0, discountRate: 10_000 },
      { id: "2", name: "白银会员", thresholdAmount: 5_000_000, discountRate: 9_000 },
      { id: "3", name: "黄金会员", thresholdAmount: 10_000_000, discountRate: 8_000 },
      { id: "4", name: "白金会员", thresholdAmount: 20_000_000, discountRate: 7_000 },
    ];
    const manager = {
      findOne: jest.fn(async (entity) => (entity === Member ? member : levels[3])),
      find: jest.fn().mockResolvedValue(levels),
    };
    const ruleRepository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new PointsService({ manager } as never, ruleRepository as never);

    await expect(service.account("1")).resolves.toMatchObject({
      points: 88,
      totalSpent: 60_000_000,
      level: {
        id: "4",
        name: "白金会员",
        code: "L4",
        thresholdAmount: 20_000_000,
        discountRate: 7_000,
      },
      nextLevel: null,
      levels: [
        { code: "L1", name: "普通会员" },
        { code: "L2", name: "白银会员" },
        { code: "L3", name: "黄金会员" },
        { code: "L4", name: "白金会员" },
      ],
    });
  });

  it("返回当前等级的下一等级", async () => {
    const member = { id: "1", levelId: "1", totalSpent: 2_500_000, points: 0 };
    const levels = [
      { id: "1", name: "普通会员", thresholdAmount: 0, discountRate: 10_000 },
      { id: "2", name: "白银会员", thresholdAmount: 5_000_000, discountRate: 9_000 },
    ];
    const manager = {
      findOne: jest.fn(async (entity) => (entity === Member ? member : levels[0])),
      find: jest.fn().mockResolvedValue(levels),
    };
    const service = new PointsService(
      { manager } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never
    );

    await expect(service.account("1")).resolves.toMatchObject({
      level: { code: "L1", name: "普通会员" },
      nextLevel: { code: "L2", name: "白银会员", thresholdAmount: 5_000_000 },
    });
  });
});
