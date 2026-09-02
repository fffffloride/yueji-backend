import { Column, Entity, Index } from "typeorm";

import type {
  AppointmentOperationActionValue,
  AppointmentOperatorTypeValue,
} from "../appointment.constants";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("appointment_operation_log")
@Index("idx_appointment_operation_log_appointment", ["appointmentId", "createTime", "id"])
export class AppointmentOperationLog extends BaseEntity {
  @Column({ name: "appointment_id", type: "bigint", comment: "预约ID" })
  appointmentId: string;

  @Column({ length: 20, comment: "操作(CREATE/RESCHEDULE/CANCEL/COMPLETE)" })
  action: AppointmentOperationActionValue;

  @Column({ name: "operator_type", length: 20, comment: "操作者类型(MEMBER/ADMIN/SYSTEM)" })
  operatorType: AppointmentOperatorTypeValue;

  @Column({ name: "operator_id", type: "bigint", nullable: true, comment: "会员或管理员ID" })
  operatorId?: string | null;

  @Column({ name: "before_date", type: "date", nullable: true, comment: "操作前预约日期" })
  beforeDate?: string | null;

  @Column({ name: "before_time", type: "time", nullable: true, comment: "操作前预约时间" })
  beforeTime?: string | null;

  @Column({ name: "after_date", type: "date", nullable: true, comment: "操作后预约日期" })
  afterDate?: string | null;

  @Column({ name: "after_time", type: "time", nullable: true, comment: "操作后预约时间" })
  afterTime?: string | null;

  @Column({ length: 255, nullable: true, comment: "操作原因" })
  reason?: string | null;
}
