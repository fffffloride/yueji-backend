import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";
import { BusinessException } from "../../common/exceptions/business.exception";
import { ErrorCode } from "../../common/enums/error-code.enum";
import { shouldSkipAdminAuth } from "./admin-auth-guard.utils";

/**
 * 认证守卫
 */
@Injectable()
export class JwtAuthGuard extends PassportAuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 路由访问控制逻辑
   */
  canActivate(context: ExecutionContext) {
    if (shouldSkipAdminAuth(this.reflector, context)) return true;

    // 执行 Passport 验证流程
    return super.canActivate(context);
  }

  /**
   * 处理认证结果
   */
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new BusinessException(ErrorCode.ACCESS_TOKEN_INVALID);
    }
    return user;
  }
}
