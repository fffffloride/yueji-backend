import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("biz_refund")
@Index("uk_refund_no", ["refundNo"], { unique: true })
@Index("uk_refund_order_id", ["orderId"], { unique: true })
@Index("idx_refund_member_id", ["memberId"])
@Index("idx_refund_status", ["status"])
export class Refund extends BaseEntity {
  @Column({ name: "refund_no", length: 32, comment: "退款流水号" })
  refundNo: string;

  @Column({ name: "payment_id", type: "bigint", comment: "支付流水ID" })
  paymentId: string;

  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ type: "int", comment: "退款金额(分)" })
  amount: number;

  @Column({ length: 255, comment: "退款原因" })
  reason: string;

  @Column({ type: "tinyint", default: 0, comment: "退款状态(0-处理中 1-成功 2-失败)" })
  status: number;

  @Column({ name: "third_party_no", length: 64, nullable: true, comment: "三方退款单号" })
  thirdPartyNo?: string | null;

  @Column({ name: "refund_time", type: "datetime", nullable: true, comment: "退款成功时间" })
  refundTime?: Date | null;
}
