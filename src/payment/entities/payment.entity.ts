import { Check, Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("biz_payment")
@Index("uk_payment_no", ["paymentNo"], { unique: true })
@Index("idx_payment_order_id", ["orderId"])
@Index("uk_payment_active_order_id", ["activeOrderId"], { unique: true })
@Index("uk_payment_third_party_no", ["thirdPartyNo"], { unique: true })
@Index("idx_payment_member_id", ["memberId"])
@Index("idx_payment_payer_member_id", ["payerMemberId"])
@Index("idx_payment_status", ["status"])
@Index("idx_payment_reconcile", ["status", "isDeleted", "updateTime", "id"])
@Check("chk_biz_payment_amount", "`amount` > 0")
@Check("chk_biz_payment_channel", "`channel` IN ('mock', 'wechat')")
@Check("chk_biz_payment_status", "`status` IN (0, 1, 2, 3)")
@Check("chk_biz_payment_is_deleted", "`is_deleted` IN (0, 1)")
export class Payment extends BaseEntity {
  @Column({ name: "payment_no", length: 32, comment: "支付流水号" })
  paymentNo: string;

  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "member_id", type: "bigint", comment: "订单购买人会员ID" })
  memberId: string;

  @Column({ name: "payer_member_id", type: "bigint", comment: "实际付款人会员ID" })
  payerMemberId: string;

  @Column({ type: "int", comment: "支付金额(分)" })
  amount: number;

  @Column({ length: 16, comment: "支付渠道(mock/wechat)" })
  channel: string;

  @Column({ type: "tinyint", default: 0, comment: "支付状态(0-待支付 1-成功 2-失败 3-已退款)" })
  status: number;

  @Column({ name: "third_party_no", length: 64, nullable: true, comment: "三方支付单号" })
  thirdPartyNo?: string | null;

  @Column({ name: "prepay_id", length: 64, nullable: true, comment: "微信预支付会话ID" })
  prepayId?: string | null;

  @Column({
    name: "expire_time",
    type: "datetime",
    nullable: true,
    comment: "支付尝试租约结束时间",
  })
  expireTime?: Date | null;

  @Column({
    name: "active_order_id",
    type: "bigint",
    nullable: true,
    asExpression: "CASE WHEN status = 0 AND is_deleted = 0 THEN order_id ELSE NULL END",
    generatedType: "VIRTUAL",
    insert: false,
    update: false,
    select: false,
    comment: "有效待支付订单ID(生成列)",
  })
  activeOrderId?: string | null;

  @Column({ name: "paid_time", type: "datetime", nullable: true, comment: "支付成功时间" })
  paidTime?: Date | null;
}
