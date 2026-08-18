import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export const APPOINTMENT_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/;
export const APPOINTMENT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AppointmentCreateDto {
  @ApiProperty({ description: "预约日期(YYYY-MM-DD)", example: "2026-08-20" })
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约日期格式应为YYYY-MM-DD" })
  appointmentDate: string;

  @ApiProperty({ description: "预约时间(HH:mm)", example: "14:30" })
  @IsString()
  @Matches(APPOINTMENT_TIME_PATTERN, { message: "预约时间格式应为HH:mm" })
  appointmentTime: string;
}
