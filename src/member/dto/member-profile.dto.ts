import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * 会员资料修改参数（C端）
 */
export class MemberProfileDto {
  @ApiProperty({ description: "昵称", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiProperty({ description: "头像URL", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;

  @ApiProperty({ description: "性别(1-男 2-女 0-保密)", required: false })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1, 2])
  gender?: number;
}
