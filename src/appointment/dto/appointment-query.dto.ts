import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

import { AppointmentTab, type AppointmentTabValue } from "../appointment.constants";
import { BaseQueryDto } from "@/common/dto/base-query.dto";
import { APPOINTMENT_DATE_PATTERN } from "./appointment-create.dto";

export class AppointmentQueryDto extends BaseQueryDto {
  @ApiProperty({
    description: "预约列表标签",
    required: false,
    enum: Object.values(AppointmentTab),
    default: AppointmentTab.PENDING_ARRIVAL,
  })
  @IsOptional()
  @IsIn(Object.values(AppointmentTab))
  tab?: AppointmentTabValue = AppointmentTab.PENDING_ARRIVAL;

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

  @ApiProperty({ description: "预约开始日期(YYYY-MM-DD)", required: false })
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsOptional()
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约开始日期格式应为YYYY-MM-DD" })
  startDate?: string;

  @ApiProperty({ description: "预约结束日期(YYYY-MM-DD)", required: false })
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsOptional()
  @IsString()
  @Matches(APPOINTMENT_DATE_PATTERN, { message: "预约结束日期格式应为YYYY-MM-DD" })
  endDate?: string;

  @ApiProperty({
    description: "预约场景",
    required: false,
    enum: ["CONSULTATION", "ORDER"],
  })
  @IsOptional()
  @IsIn(["CONSULTATION", "ORDER"])
  sceneType?: "CONSULTATION" | "ORDER";

  @ApiProperty({ description: "订单号", required: false })
  @IsOptional()
  @IsString()
  orderNo?: string;
}
