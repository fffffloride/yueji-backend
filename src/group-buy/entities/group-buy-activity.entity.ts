import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("group_buy_activity")
@Index("idx_group_activity_sku", ["skuId"])
export class GroupBuyActivity extends BaseEntity {
  @Column({ name: "sku_id", type: "bigint" }) skuId: string;
  @Column({ length: 100 }) name: string;
  @Column({ name: "group_price", type: "int" }) groupPrice: number;
  @Column({ name: "required_people", type: "int" }) requiredPeople: number;
  @Column({ name: "start_time", type: "datetime" }) startTime: Date;
  @Column({ name: "end_time", type: "datetime" }) endTime: Date;
  @Column({ name: "group_duration_minutes", type: "int" }) groupDurationMinutes: number;
  @Column({ type: "tinyint", default: 1 }) status: number;
}
