import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("distribution_direct_sales")
@Index("uk_distribution_direct_sales_order", ["orderId"], { unique: true })
export class DistributionDirectSale extends BaseEntity {
  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "buyer_member_id", type: "bigint", comment: "买家会员ID" })
  buyerMemberId: string;

  @Column({ name: "agent_id", type: "bigint", comment: "直属代理ID" })
  agentId: string;

  @Column({ name: "referral_id", type: "bigint", comment: "推荐关系ID" })
  referralId: string;

  @Column({ type: "int", comment: "实付金额(分)" })
  amount: number;

  @Column({ type: "tinyint", default: 0, comment: "状态(0-待核销 1-已计入 2-已冲销)" })
  status: number;

  @Column({ name: "paid_time", type: "datetime", comment: "支付时间" })
  paidTime: Date;

  @Column({ name: "applied_time", type: "datetime", nullable: true, comment: "计入时间" })
  appliedTime?: Date | null;

  @Column({ name: "reversed_time", type: "datetime", nullable: true, comment: "冲销时间" })
  reversedTime?: Date | null;
}
