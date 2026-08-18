import axios from "axios";

import { MemberAuthService } from "./member-auth.service";

const createService = (configValues: Record<string, string> = {}) => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => configValues[key] ?? defaultValue),
  };
  const service = new MemberAuthService(
    { expiresIn: 7200 } as never,
    {} as never,
    configService as never,
    {} as never,
    {} as never
  );
  return { service, configService };
};

describe("MemberAuthService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("通过 POST JSON 换取微信手机号", async () => {
    const { service } = createService();
    jest.spyOn(service as any, "getAccessToken").mockResolvedValue("access-token");
    const post = jest.spyOn(axios, "post").mockResolvedValue({
      data: { errcode: 0, phone_info: { phoneNumber: "13800000000" } },
    });

    await expect((service as any).getPhoneNumber("phone-code")).resolves.toBe("13800000000");
    expect(post).toHaveBeenCalledWith(
      "https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=access-token",
      { code: "phone-code" }
    );
  });

  it("开发环境默认也关闭 Mock 登录", async () => {
    const { service } = createService({ NODE_ENV: "dev" });
    await expect(service.mockLogin()).rejects.toMatchObject({
      response: { msg: "Mock 登录未启用" },
    });
  });
});
