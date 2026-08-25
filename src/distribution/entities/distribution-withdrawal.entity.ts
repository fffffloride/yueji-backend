import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_withdrawal")
@Index("uk_distribution_withdrawal_auto_period", ["agentId", "sourceMode", "autoPeriodEnd"], {
  unique: true,
})
export class DistributionWithdrawal extends BaseEntity {
  @Index("uk_distribution_withdrawal_no", { unique: true })
  @Column({ name: "withdrawal_no", length: 32, comment: "提现单号" })
  withdrawalNo: string;

  @Column({ name: "agent_id", type: "bigint", comment: "代理ID" })
  agentId: string;

  @Column({ name: "member_id", type: "bigint", comment: "会员ID快照" })
  memberId: string;

  @Column({ name: "source_mode", length: 16, comment: "来源模式" })
  sourceMode: string;

  @Column({ type: "int", comment: "提现金额(分)" })
  amount: number;

  @Column({ name: "openid_snapshot", length: 64, comment: "微信OpenID快照" })
  openidSnapshot: string;

  @Column({ type: "tinyint", default: 0, comment: "状态(0-待审核 1-待打款 2-已驳回 3-已打款)" })
  status: number;

  @Column({ name: "review_by", type: "bigint", nullable: true, comment: "审核人ID" })
  reviewBy?: string | null;

  @Column({ name: "review_time", type: "datetime", nullable: true, comment: "审核时间" })
  reviewTime?: Date | null;

  @Column({ name: "review_reason", length: 255, nullable: true, comment: "审核理由" })
  reviewReason?: string | null;

  @Column({ name: "transfer_no", length: 64, nullable: true, comment: "转账流水号" })
  transferNo?: string | null;

  @Column({ name: "paid_by", type: "bigint", nullable: true, comment: "打款确认人ID" })
  paidBy?: string | null;

  @Column({ name: "paid_time", type: "datetime", nullable: true, comment: "打款时间" })
  paidTime?: Date | null;

  @Column({ name: "paid_remark", length: 255, nullable: true, comment: "打款备注" })
  paidRemark?: string | null;

  @Column({
    name: "auto_period_end",
    type: "datetime",
    nullable: true,
    comment: "自动触发周期结束",
  })
  autoPeriodEnd?: Date | null;
}
