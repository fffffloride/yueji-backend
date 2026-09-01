import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

import { APPOINTMENT_DATE_PATTERN } from "./appointment-create.dto";

export const APPOINTMENT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class AppointmentCalendarQueryDto {
  @ApiProperty({ description: "月份(YYYY-MM)", example: "2026-08" })
  @IsString()
  @Matches(APPOINTMENT_MONTH_PATTERN, { message: "月份格式应为YYYY-MM" })
  month: string;
}

export class AppointmentSlotsQueryDto {
  @ApiProperty({ description: "预约日期(YYYY-MM-DD)", example: "2026-09-02" })
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约日期格式应为YYYY-MM-DD" })
  appointmentDate: string;
}
