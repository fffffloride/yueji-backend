import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_task")
@Index("idx_distribution_task_status_time", ["status", "startTime", "endTime"])
export class DistributionTaskEntity extends BaseEntity {
  @Column({ length: 100, comment: "任务名称" })
  name: string;

  @Column({ type: "text", nullable: true, comment: "任务描述和要求" })
  description?: string | null;

  @Column({ name: "metric_type", length: 24, comment: "SALES_AMOUNT/ORDER_COUNT" })
  metricType: string;

  @Column({ name: "target_value", type: "int", comment: "目标值(分或订单数)" })
  targetValue: number;

  @Column({ name: "start_time", type: "datetime", comment: "开始时间" })
  startTime: Date;

  @Column({ name: "end_time", type: "datetime", comment: "结束时间" })
  endTime: Date;

  @Column({ name: "assignment_scope", length: 16, comment: "ALL/LEVEL/AGENT" })
  assignmentScope: string;

  @Column({ name: "target_level_id", type: "bigint", nullable: true, comment: "指定等级ID" })
  targetLevelId?: string | null;

  @Column({ name: "target_agent_ids", type: "json", nullable: true, comment: "指定代理ID数组" })
  targetAgentIds?: string[] | null;

  @Column({ type: "tinyint", default: 0, comment: "0-草稿 1-已发布 2-已取消" })
  status: number;

  @Column({ name: "published_time", type: "datetime", nullable: true, comment: "发布时间" })
  publishedTime?: Date | null;

  @Column({ name: "cancelled_time", type: "datetime", nullable: true, comment: "取消时间" })
  cancelledTime?: Date | null;
}
