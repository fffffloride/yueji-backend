import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppointmentService } from "../appointment.service";
import { AppointmentCreateDto } from "../dto/appointment-create.dto";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C07.预约")
@MemberAuth()
@Controller("app/appointments")
export class AppointmentAppController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @ApiOperation({ summary: "提交预约日期和时间" })
  @Post()
  async create(@CurrentMember() member: CurrentMemberInfo, @Body() dto: AppointmentCreateDto) {
    return this.appointmentService.create(member.memberId, dto);
  }
}
