import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { MemberJwtGuard } from "./member-jwt.guard";

const contextOf = (request: Record<string, unknown> = {}): ExecutionContext =>
  ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const reflector = { getAllAndOverride: jest.fn(() => true) } as unknown as Reflector;

describe("MemberJwtGuard", () => {
  it("不处理后台接口", async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const guard = new MemberJwtGuard(
      jwtService as never,
      { findById: jest.fn() } as never,
      { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector
    );

    await expect(guard.canActivate(contextOf())).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("使用数据库中的有效会员身份", async () => {
    const request = { headers: { authorization: "Bearer token" } };
    const guard = new MemberJwtGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ typ: "member", sub: "1" }) } as never,
      {
        findById: jest.fn().mockResolvedValue({ id: "1", openid: "db-openid", status: 1 }),
      } as never,
      reflector
    );

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(request).toMatchObject({ member: { memberId: "1", openid: "db-openid" } });
  });

  it("拒绝已禁用会员的旧 Token", async () => {
    const guard = new MemberJwtGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ typ: "member", sub: "1" }) } as never,
      { findById: jest.fn().mockResolvedValue({ id: "1", status: 0 }) } as never,
      reflector
    );

    await expect(
      guard.canActivate(contextOf({ headers: { authorization: "Bearer token" } }))
    ).rejects.toMatchObject({ response: { msg: "账号已被禁用或不存在，请联系客服" } });
  });
});
