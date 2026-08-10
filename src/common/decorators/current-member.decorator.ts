import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { CurrentMemberInfo } from "../interfaces/current-member.interface";

/**
 * 获取当前登录会员（由 MemberJwtGuard 挂载到 request.member）
 */
export const CurrentMember = createParamDecorator(
  (data: keyof CurrentMemberInfo | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.member?.[data] : request.member;
  }
);
