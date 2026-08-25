import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_task_assignee")
@Index("uk_distribution_task_assignee", ["taskId", "agentId"], { unique: true })
export class DistributionTaskAssignee extends BaseEntity {
  @Column({ name: "task_id", type: "bigint", comment: "任务ID" })
  taskId: string;

  @Column({ name: "agent_id", type: "bigint", comment: "代理ID" })
  agentId: string;
}
