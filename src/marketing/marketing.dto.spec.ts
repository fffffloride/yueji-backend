import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CouponIssueDto, CouponSaveDto } from "./dto/marketing.dto";
import {
  CouponScopeType,
  CouponType,
  MAX_COUPON_ISSUE_MEMBERS,
  MAX_COUPON_SCOPE_IDS,
} from "./marketing.constants";

describe("marketing DTO 批量边界", () => {
  it("拒绝超过上限的定向发券会员数组", async () => {
    const dto = plainToInstance(CouponIssueDto, {
      memberIds: Array.from({ length: MAX_COUPON_ISSUE_MEMBERS + 1 }, (_, index) =>
        String(index + 1)
      ),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "memberIds")).toBe(true);
  });

  it("拒绝超过上限的优惠券适用范围数组", async () => {
    const dto = plainToInstance(CouponSaveDto, {
      name: "范围券",
      type: CouponType.FULL_REDUCTION,
      scopeType: CouponScopeType.PRODUCT,
      thresholdAmount: 0,
      discountAmount: 100,
      discountRate: 10000,
      claimStart: "2026-01-01T00:00:00.000Z",
      claimEnd: "2026-01-02T00:00:00.000Z",
      validStart: "2026-01-01T00:00:00.000Z",
      validEnd: "2026-01-03T00:00:00.000Z",
      totalQuantity: 10,
      perMemberLimit: 1,
      status: 1,
      scopeIds: Array.from({ length: MAX_COUPON_SCOPE_IDS + 1 }, (_, index) => String(index + 1)),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "scopeIds")).toBe(true);
  });
});
