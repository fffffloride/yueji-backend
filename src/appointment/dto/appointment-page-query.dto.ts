import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

import { AppointmentTab, type AppointmentTabValue } from "../appointment.constants";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

export class AppointmentPageQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "预约列表标签", enum: Object.values(AppointmentTab) })
  @IsIn(Object.values(AppointmentTab))
  tab: AppointmentTabValue;
}
