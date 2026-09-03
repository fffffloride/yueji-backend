import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import { BusinessException } from "../exceptions/business.exception";
import { ErrorCode } from "../enums/error-code.enum";
import { RedisService } from "../redis/redis.service";

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatAccessTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async getAccessToken(): Promise<string> {
    const appId = this.configService.get<string>("WX_MINIAPP_APP_ID")?.trim();
    const appSecret = this.configService.get<string>("WX_MINIAPP_APP_SECRET")?.trim();
    if (!appId || !appSecret) throw this.providerError("微信小程序 AppID 或密钥未配置");

    const cacheKey = `wechat:access_token:${appId}`;
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) return cached;

    let data: WechatTokenResponse;
    try {
      const response = await axios.get<WechatTokenResponse>(
        "https://api.weixin.qq.com/cgi-bin/token",
        {
          params: { grant_type: "client_credential", appid: appId, secret: appSecret },
          timeout: 10_000,
        }
      );
      data = response.data;
    } catch {
      throw this.providerError("获取微信 AccessToken 失败");
    }
    if (data.errcode || !data.access_token) {
      throw this.providerError(
        `获取微信 AccessToken 失败：${data.errmsg || data.errcode || "未知错误"}`
      );
    }

    const expiresIn = Math.max((data.expires_in || 7200) - 300, 60);
    await this.redisService.set(cacheKey, data.access_token, expiresIn);
    return data.access_token;
  }

  private providerError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.THIRD_PARTY_SERVICE_ERROR, msg });
  }
}
