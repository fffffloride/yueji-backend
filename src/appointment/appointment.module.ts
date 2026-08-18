import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppointmentAdminController } from "./admin/appointment-admin.controller";
import { AppointmentAppController } from "./app/appointment-app.controller";
import { AppointmentService } from "./appointment.service";
import { Appointment } from "./entities/appointment.entity";
import { Member } from "@/member/entities/member.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, Member])],
  controllers: [AppointmentAdminController, AppointmentAppController],
  providers: [AppointmentService],
})
export class AppointmentModule {}
