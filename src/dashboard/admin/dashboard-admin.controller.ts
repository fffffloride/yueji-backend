import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Permissions } from "@/common/decorators/auth.decorator";
import { DashboardService } from "../dashboard.service";
import { DashboardOverviewQueryDto } from "../dto/dashboard.dto";

@ApiTags("01.仪表盘")
@Controller("dashboard")
export class DashboardAdminController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  @Permissions("dashboard:view")
  @ApiOperation({ summary: "获取仪表盘真实数据" })
  overview(@Query() query: DashboardOverviewQueryDto) {
    return this.dashboardService.getOverview(query.days);
  }
}
