import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_level")
@Index("uk_distribution_level_rank", ["rank"], { unique: true })
export class DistributionLevel extends BaseEntity {
  @Column({ length: 64, comment: "等级名称" })
  name: string;

  @Column({ type: "smallint", comment: "等级顺序" })
  rank: number;

  @Column({
    name: "upgrade_sales_amount",
    type: "int",
    default: 0,
    comment: "升级直属业绩门槛(分)",
  })
  upgradeSalesAmount: number;

  @Column({ name: "distribution_depth", type: "tinyint", default: 1, comment: "分销深度(1/2)" })
  distributionDepth: number;

  @Column({ name: "level1_rate_bps", type: "int", default: 0, comment: "一级佣金万分比" })
  level1RateBps: number;

  @Column({ name: "level2_rate_bps", type: "int", default: 0, comment: "二级佣金万分比" })
  level2RateBps: number;

  @Column({ type: "tinyint", default: 1, comment: "状态(1-启用 0-停用)" })
  status: number;

  @Column({ type: "smallint", default: 0, comment: "排序" })
  sort: number;
}
