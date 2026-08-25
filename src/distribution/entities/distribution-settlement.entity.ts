import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_settlement")
@Index(
  "uk_distribution_settlement_agent_period",
  ["agentId", "profitPoint", "periodStart", "periodEnd"],
  { unique: true }
)
export class DistributionSettlement extends BaseEntity {
  @Index("uk_distribution_settlement_no", { unique: true })
  @Column({ name: "settlement_no", length: 32, comment: "结算单号" })
  settlementNo: string;

  @Column({ name: "agent_id", type: "bigint", comment: "代理ID" })
  agentId: string;

  @Column({ name: "profit_point", length: 32, comment: "分润类型" })
  profitPoint: string;

  @Column({ name: "period_start", type: "datetime", comment: "周期开始" })
  periodStart: Date;

  @Column({ name: "period_end", type: "datetime", comment: "周期结束" })
  periodEnd: Date;

  @Column({ name: "commission_count", type: "int", comment: "佣金条数" })
  commissionCount: number;

  @Column({ type: "int", comment: "结算金额(分)" })
  amount: number;

  @Column({ name: "settled_time", type: "datetime", comment: "结算时间" })
  settledTime: Date;
}
