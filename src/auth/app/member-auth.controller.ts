import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { MemberAuthService } from "./member-auth.service";
import {
  MemberLoginResultDto,
  MemberRefreshTokenDto,
  MockLoginDto,
  PhoneLoginDto,
  SilentLoginDto,
} from "./dto/member-login.dto";
import { Public } from "@/common/decorators/auth.decorator";
import { RateLimit } from "@/common/decorators/rate-limit.decorator";

/**
 * 会员认证接口（C端小程序）
 */
@ApiTags("C01.会员认证")
@Public()
@Controller("app/auth")
export class MemberAuthController {
  constructor(private readonly memberAuthService: MemberAuthService) {}

  @Post("silent-login")
  @RateLimit({ limit: 10, windowSec: 60 })
  @ApiOperation({ summary: "静默登录（wx.login code 换会员 Token）" })
  async silentLogin(@Body() dto: SilentLoginDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.silentLogin(dto.code);
  }

  @Post("phone-login")
  @RateLimit({ limit: 5, windowSec: 60 })
  @ApiOperation({ summary: "手机号快捷登录" })
  async phoneLogin(@Body() dto: PhoneLoginDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.phoneLogin(dto.loginCode, dto.phoneCode);
  }

  @Post("mock-login")
  @RateLimit({ limit: 10, windowSec: 60 })
  @ApiOperation({ summary: "Mock 登录（仅开发环境，无需真实微信配置）" })
  async mockLogin(@Body() dto: MockLoginDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.mockLogin(dto.openid, dto.mobile);
  }

  @Post("refresh-token")
  @RateLimit({ limit: 10, windowSec: 60 })
  @ApiOperation({ summary: "刷新会员 Token" })
  async refreshToken(@Body() dto: MemberRefreshTokenDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.refreshToken(dto.refreshToken);
  }
}
