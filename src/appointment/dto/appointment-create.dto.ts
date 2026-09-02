import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches } from "class-validator";

export const APPOINTMENT_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/;
export const APPOINTMENT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AppointmentCreateDto {
  @ApiProperty({ description: "预约日期(YYYY-MM-DD)", example: "2026-08-20" })
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约日期格式应为YYYY-MM-DD" })
  appointmentDate: string;

  @ApiProperty({ description: "预约时间(HH:mm)", example: "14:00" })
  @IsString()
  @Matches(APPOINTMENT_TIME_PATTERN, { message: "预约时间格式应为HH:mm" })
  appointmentTime: string;

  @ApiPropertyOptional({ description: "订单预约关联的订单ID", example: "123" })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : String(value)
  )
  @IsString()
  @Matches(/^\d+$/, { message: "订单ID格式无效" })
  orderId?: string;
}

export class AppointmentOrderEligibilityQueryDto {
  @ApiProperty({ description: "订单ID", example: "123" })
  @Transform(({ value }) => String(value))
  @IsString()
  @Matches(/^\d+$/, { message: "订单ID格式无效" })
  orderId: string;
}
