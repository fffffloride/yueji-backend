import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { GroupBuyService } from "./group-buy.service";

@Injectable()
export class GroupBuyTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GroupBuyTask.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly service: GroupBuyService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.service
        .reconcile()
        .catch((error) => this.logger.warn(`拼团补偿任务失败: ${String(error)}`));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
