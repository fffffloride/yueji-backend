import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_agent_log")
export class DistributionAgentLog extends BaseEntity {
  @Column({ name: "agent_id", type: "bigint", comment: "代理ID" })
  agentId: string;

  @Column({ length: 32, comment: "操作类型" })
  action: string;

  @Column({ name: "before_value", type: "json", nullable: true, comment: "变更前快照" })
  beforeValue?: Record<string, unknown> | null;

  @Column({ name: "after_value", type: "json", nullable: true, comment: "变更后快照" })
  afterValue?: Record<string, unknown> | null;

  @Column({ length: 255, comment: "操作原因" })
  reason: string;

  @Column({ name: "operator_id", type: "bigint", nullable: true, comment: "操作人ID" })
  operatorId?: string | null;
}
