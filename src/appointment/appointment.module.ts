import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppointmentAdminController } from "./admin/appointment-admin.controller";
import { AppointmentAppController } from "./app/appointment-app.controller";
import { AppointmentService } from "./appointment.service";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { AppointmentOperationLog } from "./entities/appointment-operation-log.entity";
import { Member } from "@/member/entities/member.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { BizOrderItem } from "@/order/entities/order-item.entity";
import { Refund } from "@/payment/entities/refund.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentOperationLog,
      AppointmentConfig,
      Member,
      BizOrder,
      BizOrderItem,
      Refund,
    ]),
  ],
  controllers: [AppointmentAdminController, AppointmentAppController],
  providers: [AppointmentService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
