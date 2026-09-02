import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

import { APPOINTMENT_DATE_PATTERN, APPOINTMENT_TIME_PATTERN } from "./appointment-create.dto";

export class AppointmentCancelDto {
  @ApiPropertyOptional({ description: "取消原因", maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class AppointmentRescheduleDto extends AppointmentCancelDto {
  @ApiProperty({ description: "新预约日期(YYYY-MM-DD)", example: "2026-09-10" })
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约日期格式应为YYYY-MM-DD" })
  appointmentDate: string;

  @ApiProperty({ description: "新预约时间(HH:mm)", example: "16:00" })
  @IsString()
  @Matches(APPOINTMENT_TIME_PATTERN, { message: "预约时间格式应为HH:mm" })
  appointmentTime: string;
}
