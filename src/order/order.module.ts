import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { BizOrder } from "./entities/order.entity";
import { BizOrderItem } from "./entities/order-item.entity";
import { OrderService } from "./order.service";
import { OrderTimeoutTask } from "./order-timeout.task";
import { OrderAppController } from "./app/order-app.controller";
import { OrderAdminController } from "./admin/order-admin.controller";
import { CartModule } from "@/cart/cart.module";
import { ProductModule } from "@/product/product.module";
import { Member } from "@/member/entities/member.entity";
import { DomainEvents } from "@/common/events/domain-events";
import { MarketingModule } from "@/marketing/marketing.module";
import { RedisSharedModule } from "@/common/redis/redis.module";
import { AppointmentModule } from "@/appointment/appointment.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([BizOrder, BizOrderItem, Member]),
    CartModule,
    ProductModule,
    MarketingModule,
    RedisSharedModule,
    AppointmentModule,
  ],
  controllers: [OrderAdminController, OrderAppController],
  providers: [OrderService, OrderTimeoutTask, DomainEvents],
  exports: [OrderService, DomainEvents],
})
export class OrderModule {}
