import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

import { BaseQueryDto } from "@/common/dto/base-query.dto";

export class DecorationQueryDto extends BaseQueryDto {
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

export class BannerFormDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  imageUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ enum: [0, 1], default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;
}

export class NoticeFormDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ enum: [0, 1], default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;
}

export class BrandFormDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200000)
  content: string;
}

export class DecorationStatusDto {
  @ApiProperty({ enum: [0, 1] })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;
}
