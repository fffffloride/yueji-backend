import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("appointment")
@Index("uk_member_appointment_time", ["memberId", "appointmentDate", "appointmentTime"], {
  unique: true,
})
@Index("uk_appointment_order_id", ["orderId"], { unique: true })
export class Appointment extends BaseEntity {
  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ name: "appointment_date", type: "date", comment: "预约日期" })
  appointmentDate: string;

  @Column({ name: "appointment_time", type: "time", comment: "预约时间" })
  appointmentTime: string;

  @Column({
    name: "scene_type",
    length: 20,
    default: "CONSULTATION",
    comment: "预约场景(CONSULTATION-面诊 ORDER-订单)",
  })
  sceneType: "CONSULTATION" | "ORDER";

  @Column({ name: "order_id", type: "bigint", nullable: true, comment: "关联订单ID" })
  orderId?: string | null;
}
