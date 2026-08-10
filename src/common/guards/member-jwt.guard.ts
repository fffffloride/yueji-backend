import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { BusinessException } from "../exceptions/business.exception";
import { ErrorCode } from "../enums/error-code.enum";
import type { CurrentMemberInfo } from "../interfaces/current-member.interface";

/**
 * C端会员认证守卫
 *
 * - 校验 Authorization: Bearer <token>
 * - 仅接受会员 Token（payload.typ === "member"），管理员 Token 访问 C 端接口将被拒绝
 * - 验证通过后将会员信息挂载到 request.member
 */
@Injectable()
export class MemberJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const member: CurrentMemberInfo = {
      memberId: String(payload.sub),
      openid: payload.openid,
    };
    request.member = member;
    return true;
  }
}
