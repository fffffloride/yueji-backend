import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { Payment } from "./entities/payment.entity";
import { Refund } from "./entities/refund.entity";
import { PAYMENT_DRIVER, type PaymentDriver } from "./payment-driver";
import { PaymentStatus, RefundStatus } from "./payment-status";
import { OrderService } from "@/order/order.service";
import { OrderStatus } from "@/order/order-status";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Inject(PAYMENT_DRIVER)
    private readonly driver: PaymentDriver,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly orderService: OrderService
  ) {}

  async create(memberId: string, orderId: string) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Payment, { where: { orderId, isDeleted: 0 } });
      if (existing) {
        if (String(existing.memberId) !== String(memberId)) {
          throw this.userError("支付单不存在");
        }
        const locked = await manager.findOne(Payment, {
          where: { id: existing.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!locked) {
          throw this.userError("支付单不存在");
        }
        return this.toPaymentVo(locked);
      }

      // 首次创建尚无支付行可锁，先锁订单串行化同一订单的创建请求。
      const order = await this.orderService.lockForPayment(manager, orderId, memberId);
      const concurrent = await manager.findOne(Payment, {
        where: { orderId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (concurrent) {
        return this.toPaymentVo(concurrent);
      }
      if (order.status !== OrderStatus.UNPAID) {
        throw this.userError("当前订单不可支付");
      }

      const payment = manager.create(Payment, {
        paymentNo: this.nextNo("P"),
        orderId: order.id,
        memberId,
        amount: order.payAmount,
        channel: this.driverName(),
        status: PaymentStatus.PENDING,
        isDeleted: 0,
      });
      await manager.save(payment);
      const created = await this.driver.create({
        paymentNo: payment.paymentNo,
        orderNo: order.orderNo,
        amount: payment.amount,
        description: `悦己订单 ${order.orderNo}`,
      });
      return this.toPaymentVo(payment, created.invokeParams);
    });
  }

  async queryOwned(memberId: string, paymentNo: string) {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNo, memberId, isDeleted: 0 },
    });
    if (!payment) {
      throw this.userError("支付单不存在");
    }
    const driverResult = await this.driver.query(paymentNo);
    return { ...this.toPaymentVo(payment), driverStatus: driverResult.status };
  }

  async getByOrder(orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId, isDeleted: 0 },
    });
    if (!payment) {
      throw this.userError("支付单不存在");
    }
    return this.toPaymentVo(payment);
  }

  async confirmMock(memberId: string, paymentNo: string) {
    if (this.isProduction()) {
      throw this.userError("生产环境禁止模拟支付确认");
    }
    const owned = await this.paymentRepository.findOne({
      where: { paymentNo, memberId, isDeleted: 0 },
    });
    if (!owned) {
      throw this.userError("支付单不存在");
    }
    const confirmed = await this.driver.confirmCallback({ paymentNo, success: true });
    if (confirmed.status !== "SUCCESS") {
      throw this.userError("支付确认失败");
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { paymentNo, memberId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!payment) {
        throw this.userError("支付单不存在");
      }
      if (payment.status === PaymentStatus.SUCCESS) {
        return { payment, order: null, changed: false };
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw this.userError("当前支付单不可确认");
      }

      const order = await this.orderService.lockForPayment(manager, payment.orderId, memberId);
      if (order.status !== OrderStatus.UNPAID) {
        throw this.userError("当前订单不可支付");
      }
      const paidAt = confirmed.paidAt ?? new Date();
      await this.orderService.markPaid(
        manager,
        order,
        paidAt,
        payment.channel === "wechat" ? 1 : 2
      );
      payment.status = PaymentStatus.SUCCESS;
      payment.thirdPartyNo = confirmed.thirdPartyNo ?? null;
      payment.paidTime = paidAt;
      await manager.save(payment);
      return { payment, order, changed: true };
    });

    if (result.changed && result.order) {
      this.orderService.publishPaid(result.order);
    }
    return this.toPaymentVo(result.payment);
  }

  async refund(paymentNo: string, reason: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { paymentNo, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!payment) {
        throw this.userError("支付单不存在");
      }

      const existing = await manager.findOne(Refund, {
        where: { orderId: payment.orderId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (existing?.status === RefundStatus.SUCCESS) {
        return { refund: existing, order: null, changed: false };
      }
      if (payment.status !== PaymentStatus.SUCCESS) {
        throw this.userError("当前支付单不可退款");
      }

      const order = await this.orderService.lockForPayment(manager, payment.orderId);
      if (order.status !== OrderStatus.PAID) {
        throw this.userError("仅已付款待核销订单可退款");
      }

      const refund =
        existing ??
        manager.create(Refund, {
          refundNo: this.nextNo("R"),
          paymentId: payment.id,
          orderId: payment.orderId,
          memberId: payment.memberId,
          amount: payment.amount,
          reason,
          status: RefundStatus.PROCESSING,
          isDeleted: 0,
        });
      refund.reason = reason;
      await manager.save(refund);

      const refunded = await this.driver.refund({
        paymentNo: payment.paymentNo,
        refundNo: refund.refundNo,
        amount: refund.amount,
        reason,
      });
      if (refunded.status !== "SUCCESS") {
        throw this.userError("退款失败");
      }

      await this.orderService.markRefunded(manager, order);
      refund.status = RefundStatus.SUCCESS;
      refund.thirdPartyNo = refunded.thirdPartyNo ?? null;
      refund.refundTime = refunded.refundedAt ?? new Date();
      payment.status = PaymentStatus.REFUNDED;
      await manager.save([refund, payment]);
      return { refund, order, changed: true };
    });

    if (result.changed && result.order) {
      this.orderService.publishRefunded(result.order);
    }
    return result.refund;
  }

  async refundByOrder(orderId: string, reason: string) {
    const payment = await this.paymentRepository.findOne({ where: { orderId, isDeleted: 0 } });
    if (!payment) throw this.userError("支付单不存在");
    return this.refund(payment.paymentNo, reason);
  }

  private driverName(): string {
    return this.configService.get<string>("PAYMENT_DRIVER", "mock").toLowerCase();
  }

  private isProduction(): boolean {
    return ["prod", "production"].includes(
      this.configService.get<string>("NODE_ENV", process.env.NODE_ENV ?? "dev").toLowerCase()
    );
  }

  private nextNo(prefix: "P" | "R"): string {
    const time = new Date();
    const stamp =
      `${time.getFullYear()}` +
      `${time.getMonth() + 1}`.padStart(2, "0") +
      `${time.getDate()}`.padStart(2, "0") +
      `${time.getHours()}`.padStart(2, "0") +
      `${time.getMinutes()}`.padStart(2, "0") +
      `${time.getSeconds()}`.padStart(2, "0");
    return `${prefix}${stamp}${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")}`;
  }

  private toPaymentVo(payment: Payment, invokeParams?: Record<string, unknown>) {
    return {
      paymentNo: payment.paymentNo,
      orderId: payment.orderId,
      amount: payment.amount,
      channel: payment.channel,
      status: payment.status,
      thirdPartyNo: payment.thirdPartyNo ?? null,
      paidTime: payment.paidTime ?? null,
      invokeParams: invokeParams ?? null,
    };
  }

  private userError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
