import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DistributionAdminController } from "./admin/distribution-admin.controller";
import { DistributionAppController } from "./app/distribution-app.controller";
import { DistributionService } from "./distribution.service";
import { DistributionTask } from "./distribution.task";
import { DistributionAgentType } from "./entities/agent-type.entity";
import { DistributionAgentLog } from "./entities/distribution-agent-log.entity";
import { DistributionAgent } from "./entities/distribution-agent.entity";
import { DistributionCommission } from "./entities/distribution-commission.entity";
import { DistributionDirectSale } from "./entities/distribution-direct-sale.entity";
import { DistributionLevel } from "./entities/distribution-level.entity";
import { DistributionReferral } from "./entities/distribution-referral.entity";
import { Member } from "@/member/entities/member.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { OrderModule } from "@/order/order.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DistributionAgentType,
      DistributionLevel,
      DistributionAgent,
      DistributionReferral,
      DistributionCommission,
      DistributionDirectSale,
      DistributionAgentLog,
      Member,
      BizOrder,
    ]),
    OrderModule,
  ],
  controllers: [DistributionAdminController, DistributionAppController],
  providers: [DistributionService, DistributionTask],
  exports: [DistributionService],
})
export class DistributionModule {}
