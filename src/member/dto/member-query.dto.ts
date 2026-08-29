import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength } from "class-validator";
import { Transform } from "class-transformer";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

/**
 * 会员分页查询参数（B端）
 */
export class MemberQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "页码", required: false, default: 1, minimum: 1, maximum: 1000 })
  @Max(1000)
  override pageNum?: number = 1;

  @ApiProperty({ description: "关键字(昵称/手机号)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keywords?: string;

  @ApiProperty({ description: "状态(1-正常 0-禁用)", required: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : Number(value)
  )
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
