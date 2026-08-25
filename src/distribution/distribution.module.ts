import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DistributionAdminController } from "./admin/distribution-admin.controller";
import { DistributionAppController } from "./app/distribution-app.controller";
import { DistributionService } from "./distribution.service";
import { DistributionSettlementService } from "./distribution-settlement.service";
import { DistributionTaskService } from "./distribution-task.service";
import { DistributionTask } from "./distribution.task";
import { DistributionAgentType } from "./entities/agent-type.entity";
import { DistributionAgentLog } from "./entities/distribution-agent-log.entity";
import { DistributionAgent } from "./entities/distribution-agent.entity";
import { DistributionCommission } from "./entities/distribution-commission.entity";
import { DistributionDirectSale } from "./entities/distribution-direct-sale.entity";
import { DistributionLevel } from "./entities/distribution-level.entity";
import { DistributionReferral } from "./entities/distribution-referral.entity";
import { DistributionSettlementConfig } from "./entities/distribution-settlement-config.entity";
import { DistributionSettlement } from "./entities/distribution-settlement.entity";
import { DistributionTaskAssignee } from "./entities/distribution-task-assignee.entity";
import { DistributionTaskEntity } from "./entities/distribution-task.entity";
import { DistributionWithdrawal } from "./entities/distribution-withdrawal.entity";
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
      DistributionSettlementConfig,
      DistributionSettlement,
      DistributionWithdrawal,
      DistributionTaskEntity,
      DistributionTaskAssignee,
      Member,
      BizOrder,
    ]),
    OrderModule,
  ],
  controllers: [DistributionAdminController, DistributionAppController],
  providers: [
    DistributionService,
    DistributionSettlementService,
    DistributionTaskService,
    DistributionTask,
  ],
  exports: [DistributionService, DistributionSettlementService],
})
export class DistributionModule {}
