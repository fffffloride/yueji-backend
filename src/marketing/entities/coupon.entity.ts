import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";
import { CouponScopeType, CouponType } from "../marketing.constants";

@Entity("coupon")
@Index("idx_coupon_status_time", ["status", "claimStart", "claimEnd"])
export class Coupon extends BaseEntity {
  @Column({ length: 100, comment: "优惠券名称" })
  name: string;

  @Column({ type: "varchar", length: 24, comment: "优惠券类型" })
  type: CouponType;

  @Column({ name: "scope_type", type: "varchar", length: 16, default: CouponScopeType.ALL })
  scopeType: CouponScopeType;

  @Column({ name: "threshold_amount", type: "int", default: 0, comment: "使用门槛(分)" })
  thresholdAmount: number;

  @Column({ name: "discount_amount", type: "int", default: 0, comment: "满减金额(分)" })
  discountAmount: number;

  @Column({ name: "discount_rate", type: "int", default: 10000, comment: "折扣率(万分比)" })
  discountRate: number;

  @Column({
    name: "max_discount_amount",
    type: "int",
    nullable: true,
    comment: "折扣券最高优惠(分)",
  })
  maxDiscountAmount?: number | null;

  @Column({ name: "exchange_sku_id", type: "bigint", nullable: true, comment: "兑换SKU" })
  exchangeSkuId?: string | null;

  @Column({ name: "claim_start", type: "datetime", comment: "领取开始时间" })
  claimStart: Date;

  @Column({ name: "claim_end", type: "datetime", comment: "领取结束时间" })
  claimEnd: Date;

  @Column({ name: "valid_start", type: "datetime", comment: "有效开始时间" })
  validStart: Date;

  @Column({ name: "valid_end", type: "datetime", comment: "有效结束时间" })
  validEnd: Date;

  @Column({ name: "total_quantity", type: "int", comment: "发放总量" })
  totalQuantity: number;

  @Column({ name: "issued_quantity", type: "int", default: 0, comment: "已发数量" })
  issuedQuantity: number;

  @Column({ name: "per_member_limit", type: "int", default: 1, comment: "每人限领" })
  perMemberLimit: number;

  @Column({ type: "tinyint", default: 0, comment: "状态(0-草稿 1-启用 2-停用)" })
  status: number;
}
