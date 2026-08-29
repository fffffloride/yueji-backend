import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";

import { PaymentService } from "./payment.service";
import { RedisService } from "@/common/redis/redis.service";

const PAYMENT_RECONCILE_LOCK_KEY = "task:payment:reconcile";
const PAYMENT_RECONCILE_LOCK_SECONDS = 300;
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

/** 每分钟补偿待确认支付和处理中的退款；多实例只允许一个任务执行。 */
@Injectable()
export class PaymentReconcileTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconcileTask.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly paymentService: PaymentService,
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
          PAYMENT_RECONCILE_LOCK_KEY,
          token,
          "EX",
          PAYMENT_RECONCILE_LOCK_SECONDS,
          "NX"
        )) === "OK";
      if (!acquired) return;
      renewTimer = setInterval(() => {
        void client
          .eval(
            RENEW_LOCK_SCRIPT,
            1,
            PAYMENT_RECONCILE_LOCK_KEY,
            token,
            PAYMENT_RECONCILE_LOCK_SECONDS
          )
          .catch((error) => this.logger.warn(`续期支付补偿任务锁失败: ${String(error)}`));
      }, 60_000);
      await this.paymentService.reconcilePending();
    } catch (error) {
      this.logger.warn(`支付补偿任务失败: ${String(error)}`);
    } finally {
      if (renewTimer) clearInterval(renewTimer);
      if (acquired) {
        try {
          await client.eval(RELEASE_LOCK_SCRIPT, 1, PAYMENT_RECONCILE_LOCK_KEY, token);
        } catch (error) {
          this.logger.warn(`释放支付补偿任务锁失败: ${String(error)}`);
        }
      }
      this.running = false;
    }
  }
}
