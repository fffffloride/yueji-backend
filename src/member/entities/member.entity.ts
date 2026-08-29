import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("member")
@Index("uk_openid", ["openid"], { unique: true })
@Index("uk_member_unionid", ["unionid"], { unique: true })
@Index("uk_member_mobile", ["mobile"], { unique: true })
@Index("idx_member_nickname", ["nickname"])
@Index("idx_member_active_created", ["isDeleted", "createTime", "id"])
@Index("idx_member_active_status_created", ["isDeleted", "status", "createTime", "id"])
@Index("idx_member_level_id", ["levelId"])
@Check("chk_member_openid_not_blank", "CHAR_LENGTH(TRIM(`openid`)) > 0")
@Check("chk_member_unionid_not_blank", "`unionid` IS NULL OR CHAR_LENGTH(TRIM(`unionid`)) > 0")
@Check("chk_member_mobile_not_blank", "`mobile` IS NULL OR CHAR_LENGTH(TRIM(`mobile`)) > 0")
@Check("chk_member_nickname_not_blank", "CHAR_LENGTH(TRIM(`nickname`)) > 0")
@Check("chk_member_gender", "`gender` IN (0, 1, 2)")
@Check("chk_member_status", "`status` IN (0, 1)")
@Check("chk_member_points", "`points` >= 0")
@Check("chk_member_total_spent", "`total_spent` >= 0")
@Check("chk_member_is_deleted", "`is_deleted` IN (0, 1)")
export class Member extends BaseEntity {
  @Column({ length: 64, comment: "微信小程序openid" })
  openid: string;

  @Column({ length: 64, nullable: true, comment: "微信unionid" })
  unionid?: string | null;

  @Column({ length: 20, nullable: true, comment: "手机号" })
  mobile?: string | null;

  @Column({ length: 64, default: "微信用户", comment: "昵称" })
  nickname: string;

  @Column({ length: 255, nullable: true, comment: "头像" })
  avatar?: string | null;

  @Column({ type: "tinyint", default: 0, comment: "性别(1-男 2-女 0-保密)" })
  gender: number;

  @Column({ type: "tinyint", default: 1, comment: "状态(1-正常 0-禁用)" })
  status: number;

  @Column({ type: "int", default: 0, comment: "积分余额" })
  points: number;

  @Column({ name: "level_id", type: "bigint", nullable: true, comment: "会员等级ID" })
  levelId?: string | null;

  @Column({ name: "total_spent", type: "int", default: 0, comment: "累计完成订单实付(分)" })
  totalSpent: number;

  @Column({ name: "last_login_time", type: "datetime", nullable: true, comment: "最后登录时间" })
  lastLoginTime?: Date | null;

  @Column({ length: 255, nullable: true, comment: "会员标签(逗号分隔)" })
  tags?: string | null;

  @Column({ length: 255, nullable: true, comment: "管理员备注" })
  remark?: string | null;
}
