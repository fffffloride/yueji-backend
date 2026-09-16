import { Module } from "@nestjs/common";
import { AppointmentModule } from "../appointment/appointment.module";
import { OrderModule } from "../order/order.module";
import { ReadinessController, ReadinessService } from "./readiness.service";

@Module({
  imports: [AppointmentModule, OrderModule],
  controllers: [ReadinessController],
  providers: [ReadinessService],
})
export class ReadinessModule {}
