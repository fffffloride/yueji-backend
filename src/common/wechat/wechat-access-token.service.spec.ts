import axios from "axios";

import { WechatAccessTokenService } from "./wechat-access-token.service";

describe("WechatAccessTokenService", () => {
  afterEach(() => jest.restoreAllMocks());

  function setup(cached?: string) {
    const config = {
      get: jest.fn(
        (key: string) =>
          ({
            WX_MINIAPP_APP_ID: "wx-app",
            WX_MINIAPP_APP_SECRET: "app-secret",
          })[key]
      ),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(cached),
      set: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new WechatAccessTokenService(config as never, redis as never), redis };
  }

  it("优先复用 Redis 中的微信 access_token", async () => {
    const { service, redis } = setup("cached-token");
    const get = jest.spyOn(axios, "get");

    await expect(service.getAccessToken()).resolves.toBe("cached-token");
    expect(get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("获取新 token 时减去五分钟后写入缓存", async () => {
    const { service, redis } = setup();
    jest.spyOn(axios, "get").mockResolvedValue({
      data: { access_token: "new-token", expires_in: 7200 },
    });

    await expect(service.getAccessToken()).resolves.toBe("new-token");
    expect(redis.set).toHaveBeenCalledWith("wechat:access_token:wx-app", "new-token", 6900);
  });

  it("不在异常中暴露 app secret", async () => {
    const { service } = setup();
    jest.spyOn(axios, "get").mockRejectedValue(new Error("request failed app-secret"));

    await expect(service.getAccessToken()).rejects.not.toThrow("app-secret");
  });
});
