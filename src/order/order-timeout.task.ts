import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";

import { OrderService } from "./order.service";
import { RedisService } from "@/common/redis/redis.service";

const ORDER_TIMEOUT_LOCK_KEY = "task:order:timeout-cancel";
const ORDER_TIMEOUT_LOCK_SECONDS = 300;
const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
const RENEW_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("EXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

/** 每分钟扫描待付款超时订单并取消回补库存。 */
@Injectable()
export class OrderTimeoutTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderTimeoutTask.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly orderService: OrderService,
    private readonly redisService: RedisService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runOnce();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const token = randomUUID();
    let acquired = false;
    let renewTimer: NodeJS.Timeout | undefined;
    const client = this.redisService.getClient();
    try {
      acquired =
        (await client.set(
          ORDER_TIMEOUT_LOCK_KEY,
          token,
          "EX",
          ORDER_TIMEOUT_LOCK_SECONDS,
          "NX"
        )) === "OK";
      if (!acquired) return;
      renewTimer = setInterval(() => {
        void client
          .eval(RENEW_LOCK_SCRIPT, 1, ORDER_TIMEOUT_LOCK_KEY, token, ORDER_TIMEOUT_LOCK_SECONDS)
          .catch((err) => this.logger.warn(`续期超时取消任务锁失败: ${String(err)}`));
      }, 60_000);
      await this.orderService.cancelExpiredUnpaid();
    } catch (err) {
      this.logger.warn(`超时取消任务失败: ${String(err)}`);
    } finally {
      if (renewTimer) clearInterval(renewTimer);
      if (acquired) {
        try {
          await client.eval(RELEASE_LOCK_SCRIPT, 1, ORDER_TIMEOUT_LOCK_KEY, token);
        } catch (err) {
          this.logger.warn(`释放超时取消任务锁失败: ${String(err)}`);
        }
      }
      this.running = false;
    }
  }
}
