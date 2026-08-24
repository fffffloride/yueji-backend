import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { DistributionService } from "./distribution.service";

@Injectable()
export class DistributionTask {
  private readonly logger = new Logger(DistributionTask.name);

  constructor(private readonly service: DistributionService) {}

  @Interval(60_000)
  async reconcile() {
    const ids = await this.service.reconciliationOrderIds();
    for (const id of ids) {
      try {
        await this.service.syncOrder(id);
      } catch (error) {
        this.logger.warn(`补偿分销订单失败 orderId=${id}: ${String(error)}`);
      }
    }
  }
}
