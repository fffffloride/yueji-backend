import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService, ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

import { MemberService } from "@/member/member.service";
import { Member } from "@/member/entities/member.entity";
import { ensureMemberEnabled } from "@/member/member-status";
import { MemberLoginResultDto } from "./dto/member-login.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { WechatAccessTokenService } from "@/common/wechat/wechat-access-token.service";
import jwtConfig from "@/config/jwt.config";

interface WechatSessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatPhoneResponse {
  errcode: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
  };
}

/**
 * C端会员认证服务（微信小程序）
 *
 * 会员 Token 与管理员 Token 使用同一签名密钥，
 * 通过 payload.typ === "member" 区分身份，由 MemberJwtGuard 校验。
 */
@Injectable()
export class MemberAuthService {
  private readonly logger = new Logger(MemberAuthService.name);

  private readonly appId: string;
  private readonly appSecret: string;

  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfigData: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly wechatAccessTokenService: WechatAccessTokenService,
    private readonly memberService: MemberService
  ) {
    this.appId = this.configService.get<string>("WX_MINIAPP_APP_ID") || "";
    this.appSecret = this.configService.get<string>("WX_MINIAPP_APP_SECRET") || "";
  }

  /**
   * 静默登录：openid 找到或创建会员，直接返回会员 Token
   */
  async silentLogin(code: string): Promise<MemberLoginResultDto> {
    const session = await this.getJsCodeSession(code);
    const openid = session.openid;

    if (!openid) {
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "微信登录失败：无法获取用户标识",
      });
    }

    const member = await this.memberService.findOrCreateByOpenid(openid, session.unionid);
    ensureMemberEnabled(member);
    await this.memberService.touchLastLogin(member.id);

    return this.generateMemberToken(member);
  }

  /**
   * 手机号快捷登录：登录并绑定微信手机号
   */
  async phoneLogin(loginCode: string, phoneCode: string): Promise<MemberLoginResultDto> {
    const session = await this.getJsCodeSession(loginCode);
    const openid = session.openid;

    if (!openid) {
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "微信登录失败：无法获取用户标识",
      });
    }

    const mobile = await this.getPhoneNumber(phoneCode);

    const member = await this.memberService.findOrCreateByOpenid(openid, session.unionid, mobile);
    ensureMemberEnabled(member);
    await this.memberService.touchLastLogin(member.id);

    this.logger.log(`会员手机号登录：memberId=${member.id}`);
    return this.generateMemberToken(member);
  }

  /**
   * Mock 登录（仅非生产环境）：无需真实微信 AppId 即可联调
   */
  async mockLogin(openid?: string, mobile?: string): Promise<MemberLoginResultDto> {
    const env = this.configService.get<string>("NODE_ENV") || "dev";
    const enabled = this.configService.get<string>("MOCK_LOGIN_ENABLED", "false") === "true";
    if (env === "prod" || !enabled) {
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "Mock 登录未启用",
      });
    }

    const mockOpenid = openid || "mock_openid_dev";
    const member = await this.memberService.findOrCreateByOpenid(mockOpenid, undefined, mobile);
    ensureMemberEnabled(member);
    await this.memberService.touchLastLogin(member.id);

    this.logger.log(`Mock 登录：memberId=${member.id}`);
    return this.generateMemberToken(member);
  }

  /**
   * 刷新会员访问令牌：只接受 typ=member-refresh，并重新校验会员当前状态。
   */
  async refreshToken(refreshToken: string): Promise<MemberLoginResultDto> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    if (payload?.typ !== "member-refresh" || !payload?.sub) {
      throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    const member = await this.memberService.findById(String(payload.sub));
    ensureMemberEnabled(member);
    return this.generateMemberToken(member);
  }

  private generateMemberToken(member: Member): MemberLoginResultDto {
    const payload = {
      sub: member.id,
      typ: "member",
      openid: member.openid,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.jwtConfigData.expiresIn,
      jwtid: uuidv4(),
    });

    const refreshToken = this.jwtService.sign(
      { sub: member.id, typ: "member-refresh" },
      { expiresIn: this.jwtConfigData.expiresIn * 10, jwtid: uuidv4() }
    );

    return {
      tokenType: "Bearer",
      accessToken,
      refreshToken,
      expiresIn: this.jwtConfigData.expiresIn,
      hasMobile: !!member.mobile,
    };
  }

  private async getJsCodeSession(code: string): Promise<WechatSessionResponse> {
    try {
      const response = await axios.get<WechatSessionResponse>(
        "https://api.weixin.qq.com/sns/jscode2session",
        {
          params: {
            appid: this.appId,
            secret: this.appSecret,
            js_code: code,
            grant_type: "authorization_code",
          },
        }
      );
      const data = response.data;

      if (data.errcode && data.errcode !== 0) {
        this.logger.error(`获取微信会话信息失败：errcode=${data.errcode}`);
        throw new BusinessException({
          ...ErrorCode.USER_LOGIN_EXCEPTION,
          msg: "微信登录失败，请稍后重试",
        });
      }

      return data;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error("获取微信会话信息失败：微信接口请求异常");
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "微信登录失败，请稍后重试",
      });
    }
  }

  private async getPhoneNumber(phoneCode: string): Promise<string> {
    const accessToken = await this.wechatAccessTokenService.getAccessToken();

    try {
      const response = await axios.post<WechatPhoneResponse>(
        "https://api.weixin.qq.com/wxa/business/getuserphonenumber",
        { code: phoneCode },
        { params: { access_token: accessToken } }
      );
      const data = response.data;

      if (data.errcode !== 0) {
        this.logger.error(`获取微信手机号失败：errcode=${data.errcode}`);
        throw new BusinessException({
          ...ErrorCode.USER_LOGIN_EXCEPTION,
          msg: "获取手机号失败，请稍后重试",
        });
      }

      return data.phone_info?.phoneNumber || "";
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error("获取微信手机号失败：微信接口请求异常");
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "获取手机号失败，请稍后重试",
      });
    }
  }
}
