import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches } from "class-validator";

import { BaseQueryDto } from "@/common/dto/base-query.dto";
import { APPOINTMENT_DATE_PATTERN } from "./appointment-create.dto";

export class AppointmentQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "关键字(会员昵称/手机号)", required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ description: "预约日期(YYYY-MM-DD)", required: false })
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsOptional()
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约日期格式应为YYYY-MM-DD" })
  appointmentDate?: string;
}
