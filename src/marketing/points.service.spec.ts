import { PointsService } from "./points.service";
import { DEFAULT_POINTS_RULE } from "./marketing.constants";

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
});
