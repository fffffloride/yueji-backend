import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { BaseQueryDto } from "@/common/dto/base-query.dto";

export class GroupBuyActivityQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

export class GroupBuyActivityFormDto {
  @ApiProperty()
  @Transform(({ value }) => String(value))
  @IsString()
  skuId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: "拼团价(分)" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupPrice: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  requiredPeople: number;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10080)
  groupDurationMinutes: number;

  @ApiProperty({ enum: [0, 1] })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;
}

export class GroupBuyStatusDto {
  @ApiProperty({ enum: [0, 1] })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;
}

export class GroupBuyGroupQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : undefined))
  @IsString()
  activityId?: string;

  @ApiProperty({ required: false, enum: [0, 1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  status?: number;
}

export class GroupBuyStartDto {
  @ApiProperty()
  @Transform(({ value }) => String(value))
  @IsString()
  activityId: string;
}
