import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Payment } from "./entities/payment.entity";
import { Refund } from "./entities/refund.entity";
import { PAYMENT_DRIVER, type PaymentDriver } from "./payment-driver";
import { MockPaymentDriver } from "./mock-payment.driver";
import { WechatPaymentDriver } from "./wechat-payment.driver";
import { PaymentService } from "./payment.service";
import { PaymentAppController } from "./app/payment-app.controller";
import { PaymentAdminController } from "./admin/payment-admin.controller";
import { OrderModule } from "@/order/order.module";

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Refund]), OrderModule],
  controllers: [PaymentAppController, PaymentAdminController],
  providers: [
    MockPaymentDriver,
    WechatPaymentDriver,
    {
      provide: PAYMENT_DRIVER,
      inject: [ConfigService, MockPaymentDriver, WechatPaymentDriver],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentDriver,
        wechat: WechatPaymentDriver
      ): PaymentDriver => {
        const name = config.get<string>("PAYMENT_DRIVER", "mock").toLowerCase();
        if (name === "mock") return mock;
        if (name === "wechat") return wechat;
        throw new Error(`不支持的支付驱动：${name}`);
      },
    },
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
