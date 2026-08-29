import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("member_points_log")
@Index("uk_points_biz", ["memberId", "bizType", "bizId"], { unique: true })
@Index("idx_points_member_time", ["memberId", "createTime"])
@Index("idx_points_order", ["orderId"])
export class MemberPointsLog extends BaseEntity {
  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ name: "change_points", type: "int", comment: "积分变动" })
  changePoints: number;

  @Column({ name: "balance_after", type: "int", comment: "变动后余额" })
  balanceAfter: number;

  @Column({ name: "biz_type", length: 32, comment: "业务类型" })
  bizType: string;

  @Column({ name: "biz_id", length: 64, comment: "幂等业务ID" })
  bizId: string;

  @Column({ name: "order_id", type: "bigint", nullable: true, comment: "订单ID" })
  orderId?: string | null;

  @Column({ length: 255, nullable: true, comment: "备注" })
  remark?: string | null;
}
