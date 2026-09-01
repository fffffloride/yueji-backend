import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class AppointmentConfigDto {
  @ApiProperty({ description: "每个时间段最多预约人数", minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slotCapacity: number;
}
