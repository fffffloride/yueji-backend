import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export const APPOINTMENT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class AppointmentCalendarQueryDto {
  @ApiProperty({ description: "月份(YYYY-MM)", example: "2026-08" })
  @IsString()
  @Matches(APPOINTMENT_MONTH_PATTERN, { message: "月份格式应为YYYY-MM" })
  month: string;
}
