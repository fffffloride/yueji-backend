import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { DistributionService } from "./distribution.service";
import { DistributionSettlementService } from "./distribution-settlement.service";

@Injectable()
export class DistributionTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DistributionTask.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly service: DistributionService,
    private readonly settlementService: DistributionSettlementService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.reconcile().catch((error) => {
        this.logger.warn(`分销补偿任务失败: ${String(error)}`);
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcile() {
    const ids = await this.service.reconciliationOrderIds();
    for (const id of ids) {
      try {
        await this.service.syncOrder(id);
      } catch (error) {
        this.logger.warn(`补偿分销订单失败 orderId=${id}: ${String(error)}`);
      }
    }
    try {
      await this.settlementService.runDue();
    } catch (error) {
      this.logger.warn(`执行分销结算失败: ${String(error)}`);
    }
  }
}
