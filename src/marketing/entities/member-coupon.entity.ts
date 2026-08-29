import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("member_coupon")
@Index("idx_member_coupon_status", ["memberId", "status"])
@Index("idx_member_coupon_member_template", ["memberId", "couponId", "isDeleted"])
@Index("idx_member_coupon_template", ["couponId"])
@Index("idx_member_coupon_order", ["orderId"])
export class MemberCoupon extends BaseEntity {
  @Column({ name: "coupon_id", type: "bigint", comment: "优惠券ID" })
  couponId: string;

  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ type: "tinyint", default: 0, comment: "状态(0-未用 1-锁定 2-已用 3-过期)" })
  status: number;

  @Column({ name: "order_id", type: "bigint", nullable: true, comment: "关联订单ID" })
  orderId?: string | null;

  @Column({ name: "claimed_at", type: "datetime", comment: "领取时间" })
  claimedAt: Date;

  @Column({ name: "used_at", type: "datetime", nullable: true, comment: "使用时间" })
  usedAt?: Date | null;
}
