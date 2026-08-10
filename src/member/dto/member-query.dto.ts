import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

/**
 * 会员分页查询参数（B端）
 */
export class MemberQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "关键字(昵称/手机号)", required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ description: "状态(1-正常 0-禁用)", required: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : Number(value)
  )
  @IsInt()
  status?: number;
}
