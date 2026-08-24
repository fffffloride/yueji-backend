import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_agent_type")
export class DistributionAgentType extends BaseEntity {
  @Column({ length: 64, comment: "代理类型名称" })
  name: string;

  @Column({ type: "tinyint", default: 1, comment: "状态(1-启用 0-停用)" })
  status: number;

  @Column({ type: "smallint", default: 0, comment: "排序" })
  sort: number;
}
