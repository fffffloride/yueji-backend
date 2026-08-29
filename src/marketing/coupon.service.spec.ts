import type { EntityManager } from "typeorm";

import { CouponService } from "./coupon.service";
import { CouponScopeType, CouponTemplateStatus, CouponType } from "./marketing.constants";
import type { CouponSaveDto } from "./dto/marketing.dto";
import { Product } from "@/product/entities/product.entity";
import { Coupon } from "./entities/coupon.entity";
import { CouponScope } from "./entities/coupon-scope.entity";
import { MemberCoupon } from "./entities/member-coupon.entity";
import { Member } from "@/member/entities/member.entity";

describe("CouponService", () => {
  it("拒绝包含无效商品ID的适用范围", async () => {
    const service = new CouponService({} as never, {} as never, {} as never, {} as never);
    const manager = { count: jest.fn().mockResolvedValue(1) } as unknown as EntityManager;
    const dto = {
      type: CouponType.FULL_REDUCTION,
      scopeType: CouponScopeType.PRODUCT,
      scopeIds: ["1", "missing"],
    } as CouponSaveDto;

    await expect((service as any).assertScopeTargets(manager, dto)).rejects.toMatchObject({
      response: { msg: "优惠券适用范围包含不存在的对象" },
    });
    expect(manager.count).toHaveBeenCalledWith(Product, {
      where: { id: expect.anything(), isDeleted: 0 },
    });
  });

  it("已有领取记录时不允许缩短有效期", () => {
    const service = new CouponService({} as never, {} as never, {} as never, {} as never);
    const shared = {
      name: "券",
      type: CouponType.FULL_REDUCTION,
      scopeType: CouponScopeType.ALL,
      thresholdAmount: 100,
      discountAmount: 10,
      discountRate: 10000,
      maxDiscountAmount: null,
      exchangeSkuId: null,
      claimStart: "2026-01-01T00:00:00",
      claimEnd: "2026-01-02T00:00:00",
      validStart: "2026-01-01T00:00:00",
      totalQuantity: 10,
      perMemberLimit: 1,
      status: 1,
      scopeIds: [],
    };
    const coupon = {
      ...shared,
      claimStart: new Date(shared.claimStart),
      claimEnd: new Date(shared.claimEnd),
      validStart: new Date(shared.validStart),
      validEnd: new Date("2026-01-10T00:00:00"),
    };

    expect(() =>
      (service as any).assertIssuedFieldsFrozen(coupon, {
        ...shared,
        validEnd: "2026-01-09T00:00:00",
      })
    ).toThrow();
  });

  it("删除券模板时在事务内锁定模板行", async () => {
    const coupon = { id: "1", issuedQuantity: 0, isDeleted: 0 };
    const manager = {
      findOne: jest.fn().mockResolvedValue(coupon),
      save: jest.fn(async (value) => value),
    };
    const dataSource = { transaction: jest.fn((work) => work(manager)) };
    const service = new CouponService({} as never, {} as never, {} as never, dataSource as never);

    await expect(service.remove("1")).resolves.toBe(true);
    expect(manager.findOne).toHaveBeenCalledWith(Coupon, {
      where: { id: "1", isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1 }));
  });

  it("替换适用范围时软删除旧记录后再写入新记录", async () => {
    const oldScope = { id: "1", couponId: "9", targetType: "PRODUCT", targetId: "1", isDeleted: 0 };
    const manager = {
      find: jest.fn().mockResolvedValue([oldScope]),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => value),
    } as unknown as EntityManager;
    const service = new CouponService({} as never, {} as never, {} as never, {} as never);
    const dto = {
      type: CouponType.FULL_REDUCTION,
      scopeType: CouponScopeType.PRODUCT,
      scopeIds: ["2"],
    } as CouponSaveDto;

    await (service as any).replaceScopes(manager, "9", dto);

    expect(manager.find).toHaveBeenCalledWith(CouponScope, {
      where: { couponId: "9", isDeleted: 0 },
    });
    expect(oldScope.isDeleted).toBe(1);
    expect((manager.save as jest.Mock).mock.calls[1][0]).toEqual([
      expect.objectContaining({ couponId: "9", targetId: "2", isDeleted: 0 }),
    ]);
  });

  it("定向发券批量统计已领数量并批量写入", async () => {
    const coupon = {
      id: "9",
      status: CouponTemplateStatus.ACTIVE,
      validEnd: new Date(Date.now() + 60_000),
      perMemberLimit: 1,
      issuedQuantity: 0,
      totalQuantity: 10,
      isDeleted: 0,
    };
    const countQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ memberId: "1", count: "1" }]),
    };
    const manager = {
      findOne: jest.fn(async (entity) => (entity === Coupon ? coupon : null)),
      find: jest.fn(async (entity) => (entity === Member ? [{ id: "1" }, { id: "2" }] : [])),
      createQueryBuilder: jest.fn().mockReturnValue(countQb),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => value),
      count: jest.fn(),
    };
    const dataSource = { transaction: jest.fn((work) => work(manager)) };
    const service = new CouponService({} as never, {} as never, {} as never, dataSource as never);

    await expect(service.issue("9", ["1", "2"])).resolves.toEqual({ issued: 1, skipped: 1 });
    expect(manager.count).not.toHaveBeenCalled();
    expect(manager.createQueryBuilder).toHaveBeenCalledWith(MemberCoupon, "mc");
    expect(manager.save).toHaveBeenCalledWith([
      expect.objectContaining({ couponId: "9", memberId: "2", isDeleted: 0 }),
    ]);
    expect(coupon.issuedQuantity).toBe(1);
  });

  it("可领取券使用数据库分页并返回标准分页结构", async () => {
    const coupon = { id: "1", perMemberLimit: 2 };
    const couponQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[coupon], 1]),
    };
    const countQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ couponId: "1", count: "1" }]),
    };
    const service = new CouponService(
      { createQueryBuilder: jest.fn().mockReturnValue(couponQb) } as never,
      {} as never,
      { createQueryBuilder: jest.fn().mockReturnValue(countQb) } as never,
      {} as never
    );

    await expect(service.claimable("8", { pageNum: 2, pageSize: 10 })).resolves.toEqual({
      data: [{ ...coupon, receivedCount: 1, canClaim: true }],
      page: { pageNum: 2, pageSize: 10, total: 1 },
    });
    expect(couponQb.skip).toHaveBeenCalledWith(10);
    expect(couponQb.take).toHaveBeenCalledWith(10);
  });
});
