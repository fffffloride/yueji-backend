import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { MemberAuthService } from "./member-auth.service";
import {
  MemberLoginResultDto,
  MockLoginDto,
  PhoneLoginDto,
  SilentLoginDto,
} from "./dto/member-login.dto";
import { Public } from "@/common/decorators/auth.decorator";

/**
 * 会员认证接口（C端小程序）
 */
@ApiTags("C01.会员认证")
@Public()
@Controller("app/auth")
export class MemberAuthController {
  constructor(private readonly memberAuthService: MemberAuthService) {}

  @Post("silent-login")
  @ApiOperation({ summary: "静默登录（wx.login code 换会员 Token）" })
  async silentLogin(@Body() dto: SilentLoginDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.silentLogin(dto.code);
  }

  @Post("phone-login")
  @ApiOperation({ summary: "手机号快捷登录" })
  async phoneLogin(@Body() dto: PhoneLoginDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.phoneLogin(dto.loginCode, dto.phoneCode);
  }

  @Post("mock-login")
  @ApiOperation({ summary: "Mock 登录（仅开发环境，无需真实微信配置）" })
  async mockLogin(@Body() dto: MockLoginDto): Promise<MemberLoginResultDto> {
    return this.memberAuthService.mockLogin(dto.openid, dto.mobile);
  }
}
