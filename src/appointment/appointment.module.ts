import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppointmentAdminController } from "./admin/appointment-admin.controller";
import { AppointmentAppController } from "./app/appointment-app.controller";
import { AppointmentService } from "./appointment.service";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { Member } from "@/member/entities/member.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { BizOrderItem } from "@/order/entities/order-item.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, AppointmentConfig, Member, BizOrder, BizOrderItem]),
  ],
  controllers: [AppointmentAdminController, AppointmentAppController],
  providers: [AppointmentService],
})
export class AppointmentModule {}
