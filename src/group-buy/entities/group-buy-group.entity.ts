import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("group_buy_group")
@Index("idx_group_status_expire", ["status", "expireTime"])
export class GroupBuyGroup extends BaseEntity {
  @Column({ name: "activity_id", type: "bigint" }) activityId: string;
  @Column({ name: "leader_member_id", type: "bigint" }) leaderMemberId: string;
  @Column({ name: "required_people", type: "int" }) requiredPeople: number;
  @Column({ name: "group_price", type: "int" }) groupPrice: number;
  @Column({ name: "expire_time", type: "datetime" }) expireTime: Date;
  @Column({ type: "tinyint", default: 0 }) status: number;
  @Column({ name: "success_time", type: "datetime", nullable: true }) successTime?: Date | null;
  @Column({ name: "fail_time", type: "datetime", nullable: true }) failTime?: Date | null;
}
