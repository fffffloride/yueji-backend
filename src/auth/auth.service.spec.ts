import { AuthService } from "./auth.service";

const createService = (sessionType: "jwt" | "redis-token") => {
  const redis = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    hasKey: jest.fn().mockResolvedValue(false),
  };
  const jwt = {
    decode: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const service = new AuthService(
    { expiresIn: 7200 } as never,
    jwt as never,
    { isUserEnabled: jest.fn().mockResolvedValue(true) } as never,
    redis as never,
    { get: jest.fn((key: string) => (key === "SESSION_TYPE" ? sessionType : undefined)) } as never,
    {} as never
  );
  return { service, redis, jwt };
};

describe("AuthService logout", () => {
  it("JWT 注销按会话族撤销到 refresh 到期时间", async () => {
    const { service, redis, jwt } = createService("jwt");
    const sessionExp = Math.floor(Date.now() / 1000) + 3600;
    jwt.decode.mockReturnValue({ sid: "session-1", sessionExp });

    await service.blacklistToken("access-token");

    expect(redis.set).toHaveBeenCalledWith(
      "auth:token:family:blacklist:session-1",
      true,
      expect.any(Number)
    );
  });

  it("Redis-token 注销同时删除 access、refresh 和配对索引", async () => {
    const { service, redis, jwt } = createService("redis-token");
    redis.get.mockImplementation(async (key: string) => {
      if (key === "auth:token:access:access-token") return { userId: "1" };
      if (key === "auth:token:pair:access-token") return "refresh-token";
      if (key === "auth:user:access:1") return "access-token";
      if (key === "auth:user:refresh:1") return "refresh-token";
      return null;
    });

    await service.blacklistToken("access-token");

    expect(jwt.decode).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith("auth:token:access:access-token");
    expect(redis.del).toHaveBeenCalledWith("auth:token:refresh:refresh-token");
    expect(redis.del).toHaveBeenCalledWith("auth:token:pair:access-token");
    expect(redis.del).toHaveBeenCalledWith("auth:user:access:1");
    expect(redis.del).toHaveBeenCalledWith("auth:user:refresh:1");
  });
});

describe("AuthService refreshToken", () => {
  it("升级后继续拒绝旧版 jti 黑名单中的 refresh token", async () => {
    const { service, redis, jwt } = createService("jwt");
    jwt.verifyAsync.mockResolvedValue({
      sub: "1",
      username: "admin",
      tokenVersion: 0,
      jti: "legacy-jti",
      refreshToken: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    redis.hasKey.mockImplementation(async (key: string) =>
      key.endsWith("auth:token:blacklist:legacy-jti")
    );

    await expect(service.refreshToken("legacy-refresh-token")).rejects.toThrow();
    expect(redis.hasKey).toHaveBeenCalledWith("auth:token:blacklist:legacy-jti");
  });
});
