import { Body, Controller, Get, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { PointsService } from "../points.service";
import { PointsLogQueryDto, PointsRuleDto } from "../dto/marketing.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("18.积分管理")
@Controller("marketing/points")
export class PointsAdminController {
  constructor(private readonly service: PointsService) {}

  @Get("rule")
  @Permissions("biz:points:rule")
  rule() {
    return this.service.getRule();
  }

  @Put("rule")
  @Permissions("biz:points:rule")
  updateRule(@Body() dto: PointsRuleDto) {
    return this.service.updateRule(dto);
  }

  @Get("logs/page")
  @Permissions("biz:points:list")
  page(@Query() query: PointsLogQueryDto) {
    return this.service.page(query);
  }
}
