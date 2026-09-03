import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { BizOrder } from "./entities/order.entity";
import { BizOrderItem } from "./entities/order-item.entity";
import { BizOrderGift } from "./entities/order-gift.entity";
import { OrderGiftService } from "./order-gift.service";
import { OrderService } from "./order.service";
import { OrderTimeoutTask } from "./order-timeout.task";
import { OrderAppController } from "./app/order-app.controller";
import { OrderAdminController } from "./admin/order-admin.controller";
import { OrderGiftAppController } from "./app/order-gift-app.controller";
import { CartModule } from "@/cart/cart.module";
import { ProductModule } from "@/product/product.module";
import { Member } from "@/member/entities/member.entity";
import { DomainEvents } from "@/common/events/domain-events";
import { MarketingModule } from "@/marketing/marketing.module";
import { RedisSharedModule } from "@/common/redis/redis.module";
import { AppointmentModule } from "@/appointment/appointment.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([BizOrder, BizOrderItem, BizOrderGift, Member]),
    CartModule,
    ProductModule,
    MarketingModule,
    RedisSharedModule,
    AppointmentModule,
  ],
  controllers: [OrderAdminController, OrderAppController, OrderGiftAppController],
  providers: [OrderService, OrderGiftService, OrderTimeoutTask, DomainEvents],
  exports: [OrderService, OrderGiftService, DomainEvents],
})
export class OrderModule {}
