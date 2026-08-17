import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

const toOptionalInt = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === "" ? undefined : Number(value);

export class OrderQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "关键字(订单号/手机号/会员昵称)", required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ description: "订单状态", required: false })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  status?: number;

  @ApiProperty({ description: "会员ID", required: false })
  @IsOptional()
  @IsString()
  memberId?: string;
}

export class AppOrderQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "订单状态", required: false })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  status?: number;
}
