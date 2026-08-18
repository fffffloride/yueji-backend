import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { BusinessException } from "../exceptions/business.exception";
import { ErrorCode } from "../enums/error-code.enum";
import type { CurrentMemberInfo } from "../interfaces/current-member.interface";
import { MemberService } from "@/member/member.service";
import { ensureMemberEnabled } from "@/member/member-status";
import { METADATA } from "../constants/metadata.constant";

/**
 * C端会员认证守卫
 *
 * - 校验 Authorization: Bearer <token>
 * - 仅接受会员 Token（payload.typ === "member"），管理员 Token 访问 C 端接口将被拒绝
 * - 验证通过后将会员信息挂载到 request.member
 */
@Injectable()
export class MemberJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly memberService: MemberService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isMemberApi = this.reflector.getAllAndOverride<boolean>(METADATA.MEMBER_API, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isMemberApi) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new BusinessException(ErrorCode.ACCESS_TOKEN_INVALID);
    }

    const token = authHeader.substring("Bearer ".length);

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new BusinessException(ErrorCode.ACCESS_TOKEN_INVALID);
    }

    if (payload.typ !== "member" || !payload.sub) {
      throw new BusinessException(ErrorCode.ACCESS_TOKEN_INVALID);
    }

    const persistedMember = await this.memberService.findById(String(payload.sub));
    ensureMemberEnabled(persistedMember);

    const member: CurrentMemberInfo = {
      memberId: persistedMember.id,
      openid: persistedMember.openid,
    };
    request.member = member;
    return true;
  }
}
