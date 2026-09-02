import { Column, Entity, Index } from "typeorm";

import type { AppointmentStatusValue } from "../appointment.constants";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("appointment")
@Index("idx_appointment_member_status_time", [
  "memberId",
  "status",
  "appointmentDate",
  "appointmentTime",
])
@Index("idx_appointment_status_time", ["status", "appointmentDate", "appointmentTime"])
@Index("idx_appointment_order_status", ["orderId", "status"])
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

  @Column({ type: "tinyint", default: 0, comment: "预约状态(0-待到店 1-已完成 2-已取消)" })
  status: AppointmentStatusValue;

  @Column({ name: "complete_time", type: "datetime", nullable: true, comment: "服务完成时间" })
  completeTime?: Date | null;

  @Column({ name: "cancel_time", type: "datetime", nullable: true, comment: "取消时间" })
  cancelTime?: Date | null;

  @Column({ name: "cancel_reason", length: 255, nullable: true, comment: "取消原因" })
  cancelReason?: string | null;
}
