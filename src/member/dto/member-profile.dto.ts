import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * 会员资料修改参数（C端）
 */
export class MemberProfileDto {
  @ApiProperty({ description: "昵称", required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/\S/, { message: "昵称不能为空" })
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

/**
 * C端会员资料响应。
 *
 * 只暴露小程序实际使用的字段，禁止直接序列化 Member 实体中的微信标识、
 * 管理员备注、逻辑删除和审计字段。
 */
export class MemberProfileResponseDto {
  @ApiProperty({ description: "会员ID" })
  id: string;

  @ApiProperty({ description: "昵称" })
  nickname: string;

  @ApiProperty({ description: "头像URL", required: false, nullable: true })
  avatar?: string | null;

  @ApiProperty({ description: "手机号", required: false, nullable: true })
  mobile?: string | null;

  @ApiProperty({ description: "性别(1-男 2-女 0-保密)" })
  gender: number;

  @ApiProperty({ description: "积分余额" })
  points: number;

  @ApiProperty({ description: "累计完成订单实付(分)" })
  totalSpent: number;

  @ApiProperty({ description: "会员等级ID", required: false, nullable: true })
  levelId?: string | null;
}
