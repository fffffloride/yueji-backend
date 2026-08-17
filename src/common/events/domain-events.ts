import { Injectable } from "@nestjs/common";
import { EventEmitter } from "events";

/**
 * 领域事件总线。阶段3用 Node EventEmitter，避免为 @nestjs/event-emitter 重写 lockfile。
 * 后续积分/佣金只订阅，不改订单主流程。
 */
@Injectable()
export class DomainEvents {
  private readonly bus = new EventEmitter();

  emit(event: string, payload: unknown): void {
    this.bus.emit(event, payload);
  }

  on<T>(event: string, handler: (payload: T) => void): void {
    this.bus.on(event, handler);
  }
}
