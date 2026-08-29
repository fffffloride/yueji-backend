import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { METADATA } from "@/common/constants/metadata.constant";
import { RedisTokenAuthGuard } from "./redis-token.guard";

const contextOf = (request: Record<string, unknown> = {}): ExecutionContext =>
  ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("RedisTokenAuthGuard", () => {
  it.each([METADATA.PUBLIC, METADATA.MEMBER_API])("跳过 %s 接口", async (metadataKey) => {
    const redis = { get: jest.fn() };
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === metadataKey),
    };
    const guard = new RedisTokenAuthGuard(
      redis as never,
      reflector as unknown as Reflector,
      { isUserEnabled: jest.fn() } as never
    );

    await expect(guard.canActivate(contextOf())).resolves.toBe(true);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("保护未标记接口", async () => {
    const guard = new RedisTokenAuthGuard(
      { get: jest.fn() } as never,
      { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector,
      { isUserEnabled: jest.fn() } as never
    );

    await expect(guard.canActivate(contextOf({ headers: {} }))).rejects.toThrow();
  });

  it("拒绝已禁用后台用户的 Redis 会话", async () => {
    const guard = new RedisTokenAuthGuard(
      { get: jest.fn().mockResolvedValue({ userId: "1" }) } as never,
      { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector,
      { isUserEnabled: jest.fn().mockResolvedValue(false) } as never
    );

    await expect(
      guard.canActivate(contextOf({ headers: { authorization: "Bearer token" } }))
    ).rejects.toThrow();
  });

  it("拒绝 tokenVersion 已失效的旧 Redis 会话", async () => {
    const redis = {
      get: jest
        .fn()
        .mockImplementation(async (key: string) =>
          key.startsWith("auth:token:access:") ? { userId: "1", tokenVersion: 0 } : 1
        ),
    };
    const guard = new RedisTokenAuthGuard(
      redis as never,
      { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector,
      { isUserEnabled: jest.fn().mockResolvedValue(true) } as never
    );

    await expect(
      guard.canActivate(contextOf({ headers: { authorization: "Bearer old-token" } }))
    ).rejects.toThrow();
  });
});
