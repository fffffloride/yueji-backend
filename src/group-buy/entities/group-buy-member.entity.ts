import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("group_buy_member")
@Index("uk_group_member", ["groupId", "memberId"], { unique: true })
@Index("uk_group_order", ["orderId"], { unique: true })
export class GroupBuyMember extends BaseEntity {
  @Column({ name: "group_id", type: "bigint" }) groupId: string;
  @Column({ name: "member_id", type: "bigint" }) memberId: string;
  @Column({ name: "order_id", type: "bigint" }) orderId: string;
  @Column({ type: "tinyint", default: 0 }) status: number;
  @Column({ name: "paid_time", type: "datetime", nullable: true }) paidTime?: Date | null;
  @Column({ name: "refund_time", type: "datetime", nullable: true }) refundTime?: Date | null;
}
