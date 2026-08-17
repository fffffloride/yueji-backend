import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("biz_payment")
@Index("uk_payment_no", ["paymentNo"], { unique: true })
@Index("uk_payment_order_id", ["orderId"], { unique: true })
@Index("idx_payment_member_id", ["memberId"])
@Index("idx_payment_status", ["status"])
export class Payment extends BaseEntity {
  @Column({ name: "payment_no", length: 32, comment: "支付流水号" })
  paymentNo: string;

  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ type: "int", comment: "支付金额(分)" })
  amount: number;

  @Column({ length: 16, comment: "支付渠道(mock/wechat)" })
  channel: string;

  @Column({ type: "tinyint", default: 0, comment: "支付状态(0-待支付 1-成功 2-失败 3-已退款)" })
  status: number;

  @Column({ name: "third_party_no", length: 64, nullable: true, comment: "三方支付单号" })
  thirdPartyNo?: string | null;

  @Column({ name: "paid_time", type: "datetime", nullable: true, comment: "支付成功时间" })
  paidTime?: Date | null;
}
