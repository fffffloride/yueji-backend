import { Injectable, CanActivate, ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RedisService } from "../redis/redis.service";
import { BusinessException } from "../exceptions/business.exception";
import { ErrorCode } from "../enums/error-code.enum";
import { RATE_LIMIT_KEY, RateLimitOptions } from "../decorators/rate-limit.decorator";
import * as crypto from "crypto";

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    // 未标注 @RateLimit 的接口直接放行
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace("Bearer ", "") || "";
    const ip = request.ip || request.connection?.remoteAddress || "unknown";
    const identity = token
      ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 16)
      : ip;
    const path = `${request.method} ${request.route?.path || request.originalUrl?.split("?")[0]}`;
    const key = `rate_limit:${identity}:${path}`;

    try {
      const count = await this.redisService.getClient().incr(key);
      if (count === 1) {
        await this.redisService.getClient().expire(key, options.windowSec);
      }
      if (count > options.limit) {
        throw new BusinessException({
          code: ErrorCode.REQUEST_CONCURRENCY_LIMIT_EXCEEDED.code,
          msg: ErrorCode.REQUEST_CONCURRENCY_LIMIT_EXCEEDED.msg,
          httpStatus: 429,
        });
      }
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logger.warn("Redis 限流异常，跳过");
    }

    return true;
  }
}
