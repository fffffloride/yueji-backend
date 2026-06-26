import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RedisService } from "../redis/redis.service";
import { BusinessException } from "../exceptions/business.exception";
import { ErrorCode } from "../enums/error-code.enum";
import { LoggerUtils } from "../utils/logger.utils";
import * as crypto from "crypto";

// 仅对以下路径限流
const RATE_LIMIT_PATHS: Record<string, { limit: number; windowSec: number }> = {
  "POST /api/v1/auth/login": { limit: 5, windowSec: 60 },
  "POST /api/v1/auth/sms/code": { limit: 1, windowSec: 60 },
  "POST /api/v1/auth/login/sms": { limit: 5, windowSec: 60 },
};

const RATE_LIMIT_KEY_PREFIX = "rate_limit:";

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") {
      return next();
    }

    // 仅对匹配的接口限流，其他接口直接放行
    const routeKey = `${req.method} ${req.originalUrl?.split("?")[0]}`;
    const config = RATE_LIMIT_PATHS[routeKey];
    if (!config) {
      return next();
    }

    // 按用户 token + URI 构造 key，无 token 时回退 IP
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const identity = token
      ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 16)
      : LoggerUtils.parseClientIP(req) || "unknown";

    const key = `${RATE_LIMIT_KEY_PREFIX}${identity}:${routeKey}`;

    try {
      const count = await this.redisService.getClient().incr(key);

      if (count === 1) {
        await this.redisService.getClient().expire(key, config.windowSec);
      }

      if (count > config.limit) {
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
      this.logger.warn("Redis 限流检查异常，跳过限流");
    }

    next();
  }

}
