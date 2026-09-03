import axios from "axios";

import { MemberAuthService } from "./member-auth.service";

const createService = (configValues: Record<string, string> = {}) => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => configValues[key] ?? defaultValue),
  };
  const jwtService = {
    verifyAsync: jest.fn(),
    sign: jest.fn(),
  };
  const memberService = {
    findById: jest.fn(),
    findOrCreateByOpenid: jest.fn(),
    touchLastLogin: jest.fn(),
  };
  const service = new MemberAuthService(
    { expiresIn: 7200 } as never,
    jwtService as never,
    configService as never,
    { getAccessToken: jest.fn().mockResolvedValue("access-token") } as never,
    memberService as never
  );
  return { service, configService, jwtService, memberService };
};

describe("MemberAuthService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("通过 POST JSON 换取微信手机号", async () => {
    const { service } = createService();
    const post = jest.spyOn(axios, "post").mockResolvedValue({
      data: { errcode: 0, phone_info: { phoneNumber: "13800000000" } },
    });

    await expect((service as any).getPhoneNumber("phone-code")).resolves.toBe("13800000000");
    expect(post).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/wxa/business/getuserphonenumber",
      { code: "phone-code" },
      { params: { access_token: "access-token" } }
    );
  });

  it("换取微信会话时不把 AppSecret 放进 URL", async () => {
    const { service } = createService({
      WX_MINIAPP_APP_ID: "app-id",
      WX_MINIAPP_APP_SECRET: "app-secret",
    });
    const get = jest.spyOn(axios, "get").mockResolvedValue({ data: { openid: "openid-1" } });

    await expect((service as any).getJsCodeSession("login-code")).resolves.toEqual({
      openid: "openid-1",
    });
    expect(get).toHaveBeenCalledWith("https://api.weixin.qq.com/sns/jscode2session", {
      params: {
        appid: "app-id",
        secret: "app-secret",
        js_code: "login-code",
        grant_type: "authorization_code",
      },
    });
  });

  it("手机号登录把微信身份和手机号交给同一次会员创建", async () => {
    const { service, jwtService, memberService } = createService();
    jest.spyOn(service as any, "getJsCodeSession").mockResolvedValue({
      openid: "openid-1",
      unionid: "unionid-1",
    });
    jest.spyOn(service as any, "getPhoneNumber").mockResolvedValue("13800000000");
    memberService.findOrCreateByOpenid.mockResolvedValue({
      id: "1",
      openid: "openid-1",
      mobile: "13800000000",
      status: 1,
    });
    jwtService.sign.mockReturnValueOnce("access").mockReturnValueOnce("refresh");

    await service.phoneLogin("login-code", "phone-code");

    expect(memberService.findOrCreateByOpenid).toHaveBeenCalledWith(
      "openid-1",
      "unionid-1",
      "13800000000"
    );
    expect(memberService.touchLastLogin).toHaveBeenCalledWith("1");
  });

  it("开发环境默认也关闭 Mock 登录", async () => {
    const { service } = createService({ NODE_ENV: "dev" });
    await expect(service.mockLogin()).rejects.toMatchObject({
      response: { msg: "Mock 登录未启用" },
    });
  });

  it("使用有效会员刷新令牌签发新令牌", async () => {
    const { service, jwtService, memberService } = createService();
    jwtService.verifyAsync.mockResolvedValue({ typ: "member-refresh", sub: "1" });
    jwtService.sign.mockReturnValueOnce("new-access").mockReturnValueOnce("new-refresh");
    memberService.findById.mockResolvedValue({
      id: "1",
      openid: "openid-1",
      mobile: "13800000000",
      status: 1,
    });

    await expect(service.refreshToken("refresh-token")).resolves.toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      hasMobile: true,
    });
  });

  it("拒绝管理员或会员 access token 走会员刷新接口", async () => {
    const { service, jwtService, memberService } = createService();
    jwtService.verifyAsync.mockResolvedValue({ typ: "member", sub: "1" });

    await expect(service.refreshToken("access-token")).rejects.toMatchObject({
      response: expect.objectContaining({ code: expect.any(String) }),
    });
    expect(memberService.findById).not.toHaveBeenCalled();
  });
});
