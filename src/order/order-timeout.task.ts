import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { OrderService } from "./order.service";

/** 每分钟扫描待付款超时订单并取消回补库存。 */
@Injectable()
export class OrderTimeoutTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderTimeoutTask.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly orderService: OrderService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.orderService.cancelExpiredUnpaid().catch((err) => {
        this.logger.warn(`超时取消任务失败: ${String(err)}`);
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
