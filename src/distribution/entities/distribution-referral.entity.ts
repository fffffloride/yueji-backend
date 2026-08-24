import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_referral")
@Index("uk_distribution_referral_member", ["memberId"], { unique: true })
export class DistributionReferral extends BaseEntity {
  @Column({ name: "member_id", type: "bigint", comment: "被推荐会员ID" })
  memberId: string;

  @Column({ name: "referrer_agent_id", type: "bigint", comment: "直属推荐代理ID" })
  referrerAgentId: string;

  @Column({ name: "bound_time", type: "datetime", comment: "绑定时间" })
  boundTime: Date;

  @Column({ name: "frozen_time", type: "datetime", nullable: true, comment: "关系冻结时间" })
  frozenTime?: Date | null;
}
