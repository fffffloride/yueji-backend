import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DashboardAdminController } from "./admin/dashboard-admin.controller";
import { DashboardAppController } from "./app/dashboard-app.controller";
import { DashboardService } from "./dashboard.service";
import { AppVisitDaily } from "./entities/app-visit-daily.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AppVisitDaily])],
  controllers: [DashboardAdminController, DashboardAppController],
  providers: [DashboardService],
})
export class DashboardModule {}
