import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("biz_order")
export class BizOrder extends BaseEntity {
  @Column({ name: "order_no", length: 32, comment: "订单号" })
  orderNo: string;

  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({
    type: "tinyint",
    default: 0,
    comment: "订单状态(0-待付款 1-已付款/待核销 2-已核销 3-已完成 4-已取消 5-已退款)",
  })
  status: number;

  @Column({ name: "total_amount", type: "int", default: 0, comment: "商品总额(分)" })
  totalAmount: number;

  @Column({ name: "discount_amount", type: "int", default: 0, comment: "优惠金额(分)" })
  discountAmount: number;

  @Column({ name: "pay_amount", type: "int", default: 0, comment: "实付金额(分)" })
  payAmount: number;

  @Column({
    name: "pay_type",
    type: "tinyint",
    nullable: true,
    comment: "支付方式(1-微信支付 2-Mock支付)",
  })
  payType?: number | null;

  @Column({ name: "pay_time", type: "datetime", nullable: true, comment: "支付时间" })
  payTime?: Date | null;

  @Column({ name: "contact_name", length: 32, nullable: true, comment: "联系人姓名" })
  contactName?: string | null;

  @Column({ name: "contact_mobile", length: 20, nullable: true, comment: "联系人手机号" })
  contactMobile?: string | null;

  @Column({ length: 255, nullable: true, comment: "订单备注" })
  remark?: string | null;

  @Column({ name: "verify_code", length: 32, nullable: true, comment: "核销码" })
  verifyCode?: string | null;

  @Column({ name: "verify_time", type: "datetime", nullable: true, comment: "核销时间" })
  verifyTime?: Date | null;

  @Column({ name: "verify_by", type: "bigint", nullable: true, comment: "核销人ID(sys_user)" })
  verifyBy?: string | null;

  @Column({ name: "cancel_time", type: "datetime", nullable: true, comment: "取消时间" })
  cancelTime?: Date | null;

  @Column({ name: "cancel_reason", length: 255, nullable: true, comment: "取消原因" })
  cancelReason?: string | null;
}
