import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppointmentService } from "../appointment.service";
import { AppointmentQueryDto } from "../dto/appointment-query.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("14.预约管理")
@Controller("appointments")
export class AppointmentAdminController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @ApiOperation({ summary: "预约记录分页" })
  @Get("page")
  @Permissions("biz:appointment:query")
  async page(@Query() query: AppointmentQueryDto) {
    return this.appointmentService.pageQuery(query);
  }
}
