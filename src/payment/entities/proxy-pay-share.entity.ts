import { Check, Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("biz_proxy_pay_share")
@Index("uk_proxy_pay_share_token_hash", ["tokenHash"], { unique: true })
@Index("idx_proxy_pay_share_order_id", ["orderId"])
@Check("chk_proxy_pay_share_is_deleted", "`is_deleted` IN (0, 1)")
export class ProxyPayShare extends BaseEntity {
  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "owner_member_id", type: "bigint", comment: "订单购买人会员ID" })
  ownerMemberId: string;

  @Column({ name: "token_hash", type: "char", length: 64, comment: "分享令牌SHA-256" })
  tokenHash: string;

  @Column({ name: "expires_at", type: "datetime", comment: "分享截止时间" })
  expiresAt: Date;
}
