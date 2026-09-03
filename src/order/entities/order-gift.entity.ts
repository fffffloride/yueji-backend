import { Check, Column, Entity, Index } from "typeorm";

import type { OrderGiftStatusValue } from "../order-gift-status";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("biz_order_gift")
@Index("uk_order_gift_token_hash", ["tokenHash"], { unique: true })
@Index("idx_order_gift_sender_status_created", ["senderMemberId", "status", "createTime", "id"])
@Index("idx_order_gift_recipient_status_created", [
  "recipientMemberId",
  "status",
  "createTime",
  "id",
])
@Check("chk_order_gift_status", "`status` IN (0, 1, 2, 3, 4)")
@Check("chk_order_gift_is_deleted", "`is_deleted` IN (0, 1)")
export class BizOrderGift extends BaseEntity {
  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "sender_member_id", type: "bigint", comment: "赠送会员ID" })
  senderMemberId: string;

  @Column({
    name: "recipient_member_id",
    type: "bigint",
    nullable: true,
    comment: "领取会员ID",
  })
  recipientMemberId?: string | null;

  @Column({ name: "token_hash", type: "char", length: 64, comment: "分享令牌SHA-256" })
  tokenHash: string;

  @Column({ type: "tinyint", default: 0, comment: "赠礼状态" })
  status: OrderGiftStatusValue;

  @Column({ name: "expires_at", type: "datetime", comment: "领取截止时间" })
  expiresAt: Date;

  @Column({ name: "claimed_at", type: "datetime", nullable: true, comment: "领取时间" })
  claimedAt?: Date | null;

  @Column({ name: "revoked_at", type: "datetime", nullable: true, comment: "撤回时间" })
  revokedAt?: Date | null;

  @Column({ name: "returned_at", type: "datetime", nullable: true, comment: "退回时间" })
  returnedAt?: Date | null;
}
