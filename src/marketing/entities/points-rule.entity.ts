import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("marketing_points_rule")
export class MarketingPointsRule extends BaseEntity {
  @Column({ name: "earn_per_yuan", type: "int", default: 1, comment: "每实付1元赠送积分" })
  earnPerYuan: number;

  @Column({
    name: "redeem_points_per_yuan",
    type: "int",
    default: 100,
    comment: "抵扣1元所需积分",
  })
  redeemPointsPerYuan: number;

  @Column({
    name: "max_deduct_rate",
    type: "int",
    default: 5000,
    comment: "单笔最高抵扣万分比",
  })
  maxDeductRate: number;
}
