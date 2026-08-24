import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_agent")
@Index("uk_distribution_agent_member", ["memberId"], { unique: true })
@Index("uk_distribution_agent_invite", ["inviteCode"], { unique: true })
export class DistributionAgent extends BaseEntity {
  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ name: "real_name", length: 64, comment: "姓名" })
  realName: string;

  @Column({ length: 20, nullable: true, comment: "手机号" })
  mobile?: string | null;

  @Column({ length: 64, nullable: true, comment: "微信号" })
  wechat?: string | null;

  @Column({ name: "contact_remark", length: 255, nullable: true, comment: "联系备注" })
  contactRemark?: string | null;

  @Column({ name: "type_id", type: "bigint", nullable: true, comment: "代理类型ID" })
  typeId?: string | null;

  @Column({ name: "level_id", type: "bigint", nullable: true, comment: "分销等级ID" })
  levelId?: string | null;

  @Column({ name: "parent_agent_id", type: "bigint", nullable: true, comment: "上级代理ID" })
  parentAgentId?: string | null;

  @Column({ name: "invite_code", length: 16, comment: "邀请码" })
  inviteCode: string;

  @Column({
    name: "custom_level1_rate_bps",
    type: "int",
    nullable: true,
    comment: "专属一级佣金万分比",
  })
  customLevel1RateBps?: number | null;

  @Column({
    name: "custom_level2_rate_bps",
    type: "int",
    nullable: true,
    comment: "专属二级佣金万分比",
  })
  customLevel2RateBps?: number | null;

  @Column({ name: "direct_verified_sales", type: "int", default: 0, comment: "直属有效销售额(分)" })
  directVerifiedSales: number;

  @Column({ type: "tinyint", default: 0, comment: "状态(0-待审核 1-已通过 2-已驳回 3-已禁用)" })
  status: number;

  @Column({ name: "apply_time", type: "datetime", nullable: true, comment: "申请时间" })
  applyTime?: Date | null;

  @Column({ name: "audit_time", type: "datetime", nullable: true, comment: "审核时间" })
  auditTime?: Date | null;

  @Column({ name: "audit_by", type: "bigint", nullable: true, comment: "审核人ID" })
  auditBy?: string | null;

  @Column({ name: "audit_remark", length: 255, nullable: true, comment: "审核备注" })
  auditRemark?: string | null;
}
