import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("coupon_scope")
@Index(["couponId", "targetType", "targetId"], { unique: true })
export class CouponScope extends BaseEntity {
  @Column({ name: "coupon_id", type: "bigint", comment: "优惠券ID" })
  couponId: string;

  @Column({ name: "target_type", length: 16, comment: "范围类型(CATEGORY/PRODUCT)" })
  targetType: string;

  @Column({ name: "target_id", type: "bigint", comment: "分类或商品ID" })
  targetId: string;
}
