import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RedisService } from "../redis/redis.service";
import { BusinessException } from "../exceptions/business.exception";
import { ErrorCode } from "../enums/error-code.enum";
import { LoggerUtils } from "../utils/logger.utils";
import * as crypto from "crypto";

const LUA_SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local member = ARGV[3]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window + 1000)
return redis.call('ZCARD', key)
`;

const RATE_LIMIT_PATHS: Record<string, { limit: number; windowSec: number }> = {
  "POST /api/v1/auth/login": { limit: 5, windowSec: 60 },
  "POST /api/v1/auth/sms/code": { limit: 1, windowSec: 60 },
};

const IP_LIMIT = 1000;
const IP_WINDOW_SEC = 60;

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method === "OPTIONS") return next();

    // IP 全局限流：滑动窗口计数并写入 X-RateLimit-* 头
    const ip = LoggerUtils.parseClientIP(req) || "unknown";
    let ipCount = 0;
    try {
      ipCount = await this.getIPCount(ip);
    } catch {
      // Redis 异常时放行（Fail-Open）
      ipCount = 0;
    }
    res.setHeader("X-RateLimit-Limit", IP_LIMIT);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, IP_LIMIT - ipCount));
    res.setHeader("X-RateLimit-Reset", Math.floor(Date.now() / 1000) + IP_WINDOW_SEC);
    if (ipCount > IP_LIMIT) {
      res.setHeader("Retry-After", String(IP_WINDOW_SEC));
      throw new BusinessException({
        code: ErrorCode.REQUEST_CONCURRENCY_LIMIT_EXCEEDED.code,
        msg: ErrorCode.REQUEST_CONCURRENCY_LIMIT_EXCEEDED.msg,
        httpStatus: 429,
      });
    }

    // 特定接口限流
    const routeKey = `${req.method} ${req.originalUrl?.split("?")[0]}`;
    const config = RATE_LIMIT_PATHS[routeKey];
    if (!config) return next();

    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const identity = token
      ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 16)
      : ip;
    const key = `rate_limit:api:${identity}:${req.originalUrl?.split("?")[0]}`;

    try {
      const now = Date.now();
      const member = crypto.randomUUID();
      const count = (await this.redisService
        .getClient()
        .eval(LUA_SLIDING_WINDOW, 1, key, now, config.windowSec * 1000, member)) as number;

      if (count > config.limit) {
        throw new BusinessException({
          code: ErrorCode.REQUEST_CONCURRENCY_LIMIT_EXCEEDED.code,
          msg: ErrorCode.REQUEST_CONCURRENCY_LIMIT_EXCEEDED.msg,
          httpStatus: 429,
        });
      }
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.warn("限流检查异常，跳过");
    }

    next();
  }

  private async getIPCount(ip: string): Promise<number> {
    const key = `rate_limit:ip:${ip}`;
    const now = Date.now();
    const member = crypto.randomUUID();
    const count = (await this.redisService
      .getClient()
      .eval(LUA_SLIDING_WINDOW, 1, key, now, IP_WINDOW_SEC * 1000, member)) as number;
    return count;
  }
}
