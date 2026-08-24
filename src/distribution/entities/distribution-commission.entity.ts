import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_commission")
@Index("uk_distribution_commission_order_agent_depth", ["orderId", "beneficiaryAgentId", "depth"], {
  unique: true,
})
export class DistributionCommission extends BaseEntity {
  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "order_no", length: 32, comment: "订单号" })
  orderNo: string;

  @Column({ name: "buyer_member_id", type: "bigint", comment: "买家会员ID" })
  buyerMemberId: string;

  @Column({ name: "beneficiary_agent_id", type: "bigint", comment: "受益代理ID" })
  beneficiaryAgentId: string;

  @Column({ name: "source_agent_id", type: "bigint", comment: "一级推荐代理ID" })
  sourceAgentId: string;

  @Column({ type: "tinyint", comment: "佣金层级(1/2)" })
  depth: number;

  @Column({ name: "base_amount", type: "int", comment: "佣金基数(分)" })
  baseAmount: number;

  @Column({ name: "rate_bps", type: "int", comment: "比例(万分比)" })
  rateBps: number;

  @Column({ name: "commission_amount", type: "int", comment: "佣金金额(分)" })
  commissionAmount: number;

  @Column({ name: "agent_level_id", type: "bigint", nullable: true, comment: "代理等级快照ID" })
  agentLevelId?: string | null;

  @Column({ name: "agent_level_name", length: 64, nullable: true, comment: "代理等级快照名称" })
  agentLevelName?: string | null;

  @Column({ type: "tinyint", default: 0, comment: "状态(0-待结算 1-可提现 2-已冲销)" })
  status: number;

  @Column({ name: "paid_time", type: "datetime", comment: "支付时间" })
  paidTime: Date;

  @Column({ name: "available_time", type: "datetime", nullable: true, comment: "可提现时间" })
  availableTime?: Date | null;

  @Column({ name: "reversed_time", type: "datetime", nullable: true, comment: "冲销时间" })
  reversedTime?: Date | null;
}
