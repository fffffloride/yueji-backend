import { randomInt } from "crypto";
import type { EntityManager } from "typeorm";

import type { BizOrder } from "./entities/order.entity";

const UNIQUE_RETRY_LIMIT = 8;

/** 为已锁定订单分配新核销码并保存；唯一键冲突时有限重试。 */
export async function saveOrderWithFreshVerifyCode(
  manager: EntityManager,
  order: BizOrder
): Promise<void> {
  for (let attempt = 0; attempt < UNIQUE_RETRY_LIMIT; attempt++) {
    order.verifyCode = String(randomInt(10_000_000, 100_000_000));
    try {
      await manager.save(order);
      return;
    } catch (error) {
      if (!isDuplicateEntry(error) || attempt === UNIQUE_RETRY_LIMIT - 1) throw error;
    }
  }
}

function isDuplicateEntry(error: unknown): boolean {
  const candidate = error as { code?: string; driverError?: { code?: string } };
  return (candidate.driverError?.code ?? candidate.code) === "ER_DUP_ENTRY";
}
