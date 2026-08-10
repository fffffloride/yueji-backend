import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("member")
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

  @Column({ name: "last_login_time", type: "datetime", nullable: true, comment: "最后登录时间" })
  lastLoginTime?: Date | null;
}
