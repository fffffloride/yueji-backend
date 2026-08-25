import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "@/common/decorators/auth.decorator";
import { DashboardService } from "../dashboard.service";
import { TrackVisitDto } from "../dto/dashboard.dto";

@ApiTags("C10.访问统计")
@Controller("app/analytics")
export class DashboardAppController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Public()
  @Post("visit")
  @ApiOperation({ summary: "记录小程序页面访问" })
  trackVisit(@Body() dto: TrackVisitDto) {
    return this.dashboardService.recordVisit(dto.visitorId);
  }
}
