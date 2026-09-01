import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("appointment_config")
export class AppointmentConfig extends BaseEntity {
  @Column({
    name: "slot_capacity",
    type: "int",
    default: 1,
    comment: "每个时间段最多预约人数",
  })
  slotCapacity: number;
}
