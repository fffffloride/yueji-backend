import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppointmentService } from "../appointment.service";
import {
  AppointmentCreateDto,
  AppointmentOrderEligibilityQueryDto,
} from "../dto/appointment-create.dto";
import { AppointmentSlotsQueryDto } from "../dto/appointment-calendar-query.dto";
import { Public } from "@/common/decorators/auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C07.预约")
@Controller("app/appointments")
export class AppointmentAppController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @ApiOperation({ summary: "查询指定日期的可预约时间段" })
  @Get("slots")
  @Public()
  slots(@Query() query: AppointmentSlotsQueryDto) {
    return this.appointmentService.listSlots(query.appointmentDate);
  }

  @ApiOperation({ summary: "查询订单预约资格" })
  @Get("order-eligibility")
  @MemberAuth()
  orderEligibility(
    @CurrentMember() member: CurrentMemberInfo,
    @Query() query: AppointmentOrderEligibilityQueryDto
  ) {
    return this.appointmentService.getOrderEligibility(member.memberId, query.orderId);
  }

  @ApiOperation({ summary: "提交预约日期和时间" })
  @Post()
  @MemberAuth()
  async create(@CurrentMember() member: CurrentMemberInfo, @Body() dto: AppointmentCreateDto) {
    return this.appointmentService.create(member.memberId, dto);
  }
}
