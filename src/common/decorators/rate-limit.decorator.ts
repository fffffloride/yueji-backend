import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_KEY = "rate-limit";

export interface RateLimitOptions {
  /** 时间窗口内允许的最大请求数 */
  limit: number;
  /** 时间窗口（秒） */
  windowSec: number;
}

/** 接口限流装饰器 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
