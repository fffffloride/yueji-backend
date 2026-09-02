import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppointmentService } from "../appointment.service";
import {
  AppointmentCalendarQueryDto,
  AppointmentSlotsQueryDto,
} from "../dto/appointment-calendar-query.dto";
import { AppointmentConfigDto } from "../dto/appointment-config.dto";
import { AppointmentQueryDto } from "../dto/appointment-query.dto";
import { AppointmentCancelDto, AppointmentRescheduleDto } from "../dto/appointment-action.dto";
import { Permissions } from "@/common/decorators/auth.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";

@ApiTags("14.预约管理")
@Controller("appointments")
export class AppointmentAdminController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @ApiOperation({ summary: "查询预约统计" })
  @Get("summary")
  @Permissions("biz:appointment:query")
  summary() {
    return this.appointmentService.getAdminSummary();
  }

  @ApiOperation({ summary: "预约记录分页" })
  @Get("page")
  @Permissions("biz:appointment:query")
  async page(@Query() query: AppointmentQueryDto) {
    return this.appointmentService.pageQuery(query);
  }

  @ApiOperation({ summary: "预约月历" })
  @Get("calendar")
  @Permissions("biz:appointment:query")
  async calendar(@Query() query: AppointmentCalendarQueryDto) {
    return this.appointmentService.listByMonth(query.month);
  }

  @ApiOperation({ summary: "查询改期可用时段" })
  @Get("slots")
  @Permissions("biz:appointment:query")
  slots(@Query() query: AppointmentSlotsQueryDto) {
    return this.appointmentService.listSlots(query.appointmentDate);
  }

  @ApiOperation({ summary: "查询预约容量配置" })
  @Get("config")
  @Permissions("biz:appointment:query")
  config() {
    return this.appointmentService.getConfig();
  }

  @ApiOperation({ summary: "修改预约容量配置" })
  @Put("config")
  @Permissions("biz:appointment:config")
  updateConfig(@Body() dto: AppointmentConfigDto) {
    return this.appointmentService.updateConfig(dto);
  }

  @ApiOperation({ summary: "预约详情与操作记录" })
  @Get(":id")
  @Permissions("biz:appointment:query")
  detail(@Param("id") id: string) {
    return this.appointmentService.getDetail(id);
  }

  @ApiOperation({ summary: "客服修改预约时间" })
  @Put(":id/reschedule")
  @Permissions("biz:appointment:reschedule")
  reschedule(
    @Param("id") id: string,
    @Body() dto: AppointmentRescheduleDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.appointmentService.rescheduleByAdmin(
      id,
      dto.appointmentDate,
      dto.appointmentTime,
      dto.reason,
      operatorId
    );
  }

  @ApiOperation({ summary: "客服取消预约" })
  @Post(":id/cancel")
  @Permissions("biz:appointment:cancel")
  cancel(
    @Param("id") id: string,
    @Body() dto: AppointmentCancelDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.appointmentService.cancelByAdmin(id, dto.reason, operatorId);
  }

  @ApiOperation({ summary: "完成面诊服务" })
  @Post(":id/complete")
  @Permissions("biz:appointment:complete")
  complete(@Param("id") id: string, @CurrentUser("userId") operatorId: string) {
    return this.appointmentService.completeConsultation(id, operatorId);
  }
}
