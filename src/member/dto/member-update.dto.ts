import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class MemberUpdateDto {
  @ApiProperty({ description: "会员标签(逗号分隔)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tags?: string;

  @ApiProperty({ description: "管理员备注", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
