import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * 静默登录参数
 */
export class SilentLoginDto {
  @ApiProperty({ description: "wx.login 获取的 code" })
  @IsNotEmpty({ message: "code 不能为空" })
  @IsString()
  code: string;
}

/**
 * 手机号快捷登录参数
 */
export class PhoneLoginDto {
  @ApiProperty({ description: "wx.login 获取的 code" })
  @IsNotEmpty({ message: "loginCode 不能为空" })
  @IsString()
  loginCode: string;

  @ApiProperty({ description: "手机号授权组件获取的 code" })
  @IsNotEmpty({ message: "phoneCode 不能为空" })
  @IsString()
  phoneCode: string;
}

/**
 * Mock 登录参数（仅开发环境可用）
 */
export class MockLoginDto {
  @ApiProperty({ description: "模拟 openid，默认 mock_openid_dev", required: false })
  @IsOptional()
  @IsString()
  openid?: string;

  @ApiProperty({ description: "模拟手机号", required: false })
  @IsOptional()
  @IsString()
  mobile?: string;
}

/**
 * 会员刷新令牌参数
 */
export class MemberRefreshTokenDto {
  @ApiProperty({ description: "会员刷新令牌" })
  @IsNotEmpty({ message: "refreshToken 不能为空" })
  @IsString()
  refreshToken: string;
}

/**
 * 会员登录结果
 */
export class MemberLoginResultDto {
  @ApiProperty({ description: "令牌类型", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "访问令牌" })
  accessToken: string;

  @ApiProperty({ description: "刷新令牌" })
  refreshToken: string;

  @ApiProperty({ description: "过期时间(秒)" })
  expiresIn: number;

  @ApiProperty({ description: "是否已绑定手机号" })
  hasMobile: boolean;
}
