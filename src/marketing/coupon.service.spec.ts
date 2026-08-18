import type { EntityManager } from "typeorm";

import { CouponService } from "./coupon.service";
import { CouponScopeType, CouponType } from "./marketing.constants";
import type { CouponSaveDto } from "./dto/marketing.dto";
import { Product } from "@/product/entities/product.entity";

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
});
