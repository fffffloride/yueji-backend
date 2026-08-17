import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("member_level")
export class MemberLevel extends BaseEntity {
  @Column({ length: 64, comment: "等级名称" })
  name: string;

  @Column({ name: "threshold_amount", type: "int", default: 0, comment: "累计实付门槛(分)" })
  thresholdAmount: number;

  @Column({ name: "discount_rate", type: "int", default: 10000, comment: "折扣率(万分比)" })
  discountRate: number;

  @Column({ type: "tinyint", default: 1, comment: "状态(1-启用 0-停用)" })
  status: number;

  @Column({ type: "smallint", default: 0, comment: "排序" })
  sort: number;
}
