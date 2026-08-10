import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService, ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

import { MemberService } from "@/member/member.service";
import { Member } from "@/member/entities/member.entity";
import { MemberLoginResultDto } from "./dto/member-login.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { RedisService } from "@/common/redis/redis.service";
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

interface WechatTokenResponse {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
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
    private readonly redisService: RedisService,
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
    this.ensureMemberEnabled(member);
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

    const member = await this.memberService.findOrCreateByOpenid(openid, session.unionid);
    this.ensureMemberEnabled(member);

    if (mobile && member.mobile !== mobile) {
      await this.memberService.attachMobile(member.id, mobile);
      member.mobile = mobile;
    }
    await this.memberService.touchLastLogin(member.id);

    this.logger.log(`会员手机号登录：memberId=${member.id}, mobile=${mobile}`);
    return this.generateMemberToken(member);
  }

  /**
   * Mock 登录（仅非生产环境）：无需真实微信 AppId 即可联调
   */
  async mockLogin(openid?: string, mobile?: string): Promise<MemberLoginResultDto> {
    const env = this.configService.get<string>("NODE_ENV") || "dev";
    if (env === "prod") {
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "生产环境禁用 Mock 登录",
      });
    }

    const mockOpenid = openid || "mock_openid_dev";
    const member = await this.memberService.findOrCreateByOpenid(mockOpenid);
    this.ensureMemberEnabled(member);

    if (mobile && member.mobile !== mobile) {
      await this.memberService.attachMobile(member.id, mobile);
      member.mobile = mobile;
    }
    await this.memberService.touchLastLogin(member.id);

    this.logger.log(`Mock 登录：memberId=${member.id}, openid=${mockOpenid}`);
    return this.generateMemberToken(member);
  }

  private ensureMemberEnabled(member: Member): void {
    if (member.status !== 1) {
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: "账号已被禁用，请联系客服",
      });
    }
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
      { expiresIn: this.jwtConfigData.expiresIn * 10 }
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
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.appId}&secret=${this.appSecret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const response = await axios.get<WechatSessionResponse>(url);
      const data = response.data;

      if (data.errcode && data.errcode !== 0) {
        this.logger.error(`获取微信会话信息失败：errcode=${data.errcode}, errmsg=${data.errmsg}`);
        throw new BusinessException({
          ...ErrorCode.USER_LOGIN_EXCEPTION,
          msg: `微信登录失败：${data.errmsg}`,
        });
      }

      return data;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`获取微信会话信息失败：error=${errMsg}`);
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: `微信登录失败：${errMsg}`,
      });
    }
  }

  private async getPhoneNumber(phoneCode: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}&code=${phoneCode}`;

    try {
      const response = await axios.get<WechatPhoneResponse>(url);
      const data = response.data;

      if (data.errcode !== 0) {
        this.logger.error(`获取微信手机号失败：errcode=${data.errcode}, errmsg=${data.errmsg}`);
        throw new BusinessException({
          ...ErrorCode.USER_LOGIN_EXCEPTION,
          msg: `获取手机号失败：${data.errmsg}`,
        });
      }

      return data.phone_info?.phoneNumber || "";
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`获取微信手机号失败：error=${errMsg}`);
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: `获取手机号失败：${errMsg}`,
      });
    }
  }

  private async getAccessToken(): Promise<string> {
    const cacheKey = `wechat:access_token:${this.appId}`;

    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;

    const response = await axios.get<WechatTokenResponse>(url);
    const data = response.data;

    if (data.errcode && data.errcode !== 0) {
      throw new BusinessException({
        ...ErrorCode.USER_LOGIN_EXCEPTION,
        msg: `获取微信AccessToken失败：${data.errmsg}`,
      });
    }

    const expiresIn = Math.max((data.expires_in || 7200) - 300, 60);
    await this.redisService.set(cacheKey, data.access_token, expiresIn);

    return data.access_token;
  }
}
