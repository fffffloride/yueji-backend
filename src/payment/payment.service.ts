import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { DataSource, EntityManager, Repository } from "typeorm";

import { Payment } from "./entities/payment.entity";
import { Refund } from "./entities/refund.entity";
import {
  PAYMENT_DRIVER,
  type PaymentDriver,
  type PaymentQueryResult,
  type PaymentRefundResult,
} from "./payment-driver";
import { PaymentStatus, RefundStatus } from "./payment-status";
import { OrderService } from "@/order/order.service";
import { OrderStatus } from "@/order/order-status";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

const UNIQUE_RETRY_LIMIT = 8;
const RECONCILE_BATCH_SIZE = 100;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @Inject(PAYMENT_DRIVER)
    private readonly driver: PaymentDriver,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly orderService: OrderService
  ) {}

  async create(memberId: string, orderId: string) {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Payment, { where: { orderId, isDeleted: 0 } });
      if (existing) {
        const payment = await manager.findOne(Payment, {
          where: { id: existing.id, isDeleted: 0 },
          lock: { mode: "pessimistic_write" },
        });
        if (!payment || String(payment.memberId) !== String(memberId)) {
          throw this.userError("支付单不存在");
        }
        const order = await this.orderService.lockForPayment(manager, payment.orderId, memberId);
        return {
          payment,
          orderNo: order.orderNo,
          shouldCreate:
            payment.status === PaymentStatus.PENDING && order.status === OrderStatus.UNPAID,
        };
      }

      // 首次创建尚无支付行可锁，先锁订单串行化同一订单的创建请求。
      const order = await this.orderService.lockForPayment(manager, orderId, memberId);
      const concurrent = await manager.findOne(Payment, {
        where: { orderId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (concurrent) {
        return {
          payment: concurrent,
          orderNo: order.orderNo,
          shouldCreate:
            concurrent.status === PaymentStatus.PENDING && order.status === OrderStatus.UNPAID,
        };
      }
      if (order.status !== OrderStatus.UNPAID || order.payAmount <= 0) {
        throw this.userError("当前订单不可支付");
      }

      const payment = await this.saveNewPayment(manager, {
        orderId: order.id,
        memberId,
        amount: order.payAmount,
        channel: this.driverName(),
      });
      return { payment, orderNo: order.orderNo, shouldCreate: true };
    });

    if (!prepared.shouldCreate) return this.toPaymentVo(prepared.payment);

    // 外部渠道调用必须发生在数据库事务提交之后；重试始终复用同一个 paymentNo。
    const created = await this.driver.create({
      paymentNo: prepared.payment.paymentNo,
      orderNo: prepared.orderNo,
      amount: prepared.payment.amount,
      description: `悦己订单 ${prepared.orderNo}`,
    });
    if (created.paymentNo !== prepared.payment.paymentNo) {
      throw this.providerError("支付渠道返回的支付单号不一致");
    }

    let payment = prepared.payment;
    if (created.status === "FAILED") {
      payment = await this.applyPaymentResult(
        prepared.payment.paymentNo,
        { paymentNo: prepared.payment.paymentNo, status: "FAILED" },
        memberId
      );
    } else if (created.status === "SUCCESS") {
      payment = await this.applyPaymentResult(
        prepared.payment.paymentNo,
        await this.driver.query(prepared.payment.paymentNo),
        memberId
      );
    }
    return this.toPaymentVo(payment, created.invokeParams);
  }

  async queryOwned(memberId: string, paymentNo: string) {
    const owned = await this.paymentRepository.findOne({
      where: { paymentNo, memberId, isDeleted: 0 },
    });
    if (!owned) throw this.userError("支付单不存在");

    if (owned.status === PaymentStatus.SUCCESS || owned.status === PaymentStatus.REFUNDED) {
      return { ...this.toPaymentVo(owned), driverStatus: this.driverStatus(owned.status) };
    }

    const driverResult = await this.driver.query(paymentNo);
    const payment = await this.applyPaymentResult(paymentNo, driverResult, memberId);
    return { ...this.toPaymentVo(payment), driverStatus: driverResult.status };
  }

  async getByOrder(orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId, isDeleted: 0 },
    });
    if (!payment) throw this.userError("支付单不存在");
    return this.toPaymentVo(payment);
  }

  async confirmMock(memberId: string, paymentNo: string) {
    if (this.isProduction()) throw this.userError("生产环境禁止模拟支付确认");

    const owned = await this.paymentRepository.findOne({
      where: { paymentNo, memberId, isDeleted: 0 },
    });
    if (!owned) throw this.userError("支付单不存在");
    if (owned.status === PaymentStatus.SUCCESS) return this.toPaymentVo(owned);
    if (owned.status !== PaymentStatus.PENDING) throw this.userError("当前支付单不可确认");

    const confirmed = await this.driver.confirmCallback({
      paymentNo,
      amount: owned.amount,
      success: true,
    });
    if (confirmed.status !== "SUCCESS") throw this.userError("支付确认失败");

    return this.toPaymentVo(await this.applyPaymentResult(paymentNo, confirmed, memberId));
  }

  async refund(paymentNo: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 255) {
      throw this.userError("退款原因不能为空且不能超过255个字符");
    }

    const prepared = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { paymentNo, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!payment) throw this.userError("支付单不存在");

      let refund = await manager.findOne(Refund, {
        where: { orderId: payment.orderId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (refund?.status === RefundStatus.SUCCESS) {
        return { payment, refund, shouldSubmit: false };
      }
      if (payment.status !== PaymentStatus.SUCCESS) {
        throw this.userError("当前支付单不可退款");
      }

      const order = await this.orderService.lockForPayment(manager, payment.orderId);
      if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.CANCELLED) {
        throw this.userError("仅已付款待核销订单或取消后的迟到支付可退款");
      }

      if (refund) {
        refund.reason = normalizedReason;
        refund.status = RefundStatus.PROCESSING;
        await manager.save(refund);
      } else {
        refund = await this.saveNewRefund(manager, payment, normalizedReason);
      }
      return { payment, refund, shouldSubmit: true };
    });

    if (!prepared.shouldSubmit) return prepared.refund;

    // 退款意图已经提交；网络错误时保留 PROCESSING，后续使用同一 refundNo 查询或重试。
    const result = await this.driver.refund({
      paymentNo: prepared.payment.paymentNo,
      refundNo: prepared.refund.refundNo,
      amount: prepared.refund.amount,
      reason: prepared.refund.reason,
    });
    return this.applyRefundResult(prepared.payment.paymentNo, prepared.refund.refundNo, result);
  }

  async refundByOrder(orderId: string, reason: string) {
    const payment = await this.paymentRepository.findOne({ where: { orderId, isDeleted: 0 } });
    if (!payment) throw this.userError("支付单不存在");
    return this.refund(payment.paymentNo, reason);
  }

  /** 补偿渠道异步结果；每次限量，更新时间用于轮转长期 PENDING 记录。 */
  async reconcilePending(limit = RECONCILE_BATCH_SIZE) {
    const batchSize = Math.max(1, Math.min(limit, RECONCILE_BATCH_SIZE));
    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.PENDING, isDeleted: 0 },
      order: { updateTime: "ASC", id: "ASC" },
      take: batchSize,
    });
    let paymentChecked = 0;
    for (const payment of payments) {
      try {
        const result = await this.driver.query(payment.paymentNo);
        await this.applyPaymentResult(payment.paymentNo, result);
        paymentChecked += 1;
      } catch (error) {
        this.logger.warn(`同步支付结果失败 paymentId=${payment.id}: ${String(error)}`);
      }
    }

    const refunds = await this.refundRepository.find({
      where: { status: RefundStatus.PROCESSING, isDeleted: 0 },
      order: { updateTime: "ASC", id: "ASC" },
      take: batchSize,
    });
    let refundChecked = 0;
    for (const refund of refunds) {
      try {
        const payment = await this.paymentRepository.findOne({
          where: { id: refund.paymentId, isDeleted: 0 },
        });
        if (!payment) throw this.userError("支付单不存在");
        // refundNo 是渠道幂等键；重新提交同时覆盖“意图已提交但进程在调用渠道前退出”的窗口。
        const result = await this.driver.refund({
          paymentNo: payment.paymentNo,
          refundNo: refund.refundNo,
          amount: refund.amount,
          reason: refund.reason,
        });
        await this.applyRefundResult(payment.paymentNo, refund.refundNo, result);
        refundChecked += 1;
      } catch (error) {
        this.logger.warn(`同步退款结果失败 refundId=${refund.id}: ${String(error)}`);
      }
    }
    return { paymentChecked, refundChecked };
  }

  private async applyPaymentResult(
    paymentNo: string,
    driverResult: PaymentQueryResult,
    memberId?: string
  ): Promise<Payment> {
    if (driverResult.paymentNo !== paymentNo) {
      throw this.providerError("支付渠道返回的支付单号不一致");
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { paymentNo, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!payment || (memberId && String(payment.memberId) !== String(memberId))) {
        throw this.userError("支付单不存在");
      }

      if (driverResult.status === "PENDING") {
        payment.updateTime = new Date();
        await manager.save(payment);
        return { payment, order: null, paidChanged: false, needsRefund: false };
      }
      if (driverResult.status === "FAILED") {
        if (payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.FAILED;
          await manager.save(payment);
        }
        return { payment, order: null, paidChanged: false, needsRefund: false };
      }
      if (driverResult.status === "REFUNDED") {
        if (payment.status !== PaymentStatus.REFUNDED) {
          throw this.providerError("渠道支付已退款，但本地退款单尚未完成同步");
        }
        return { payment, order: null, paidChanged: false, needsRefund: false };
      }

      if (!Number.isInteger(driverResult.amount) || driverResult.amount !== payment.amount) {
        throw this.providerError("支付渠道返回金额与本地支付单不一致");
      }
      if (payment.status === PaymentStatus.REFUNDED || payment.status === PaymentStatus.SUCCESS) {
        return { payment, order: null, paidChanged: false, needsRefund: false };
      }

      const order = await this.orderService.lockForPayment(
        manager,
        payment.orderId,
        payment.memberId
      );
      let paidChanged = false;
      let needsRefund = false;
      if (order.status === OrderStatus.UNPAID) {
        await this.orderService.markPaid(
          manager,
          order,
          driverResult.paidAt ?? new Date(),
          payment.channel === "wechat" ? 1 : 2
        );
        paidChanged = true;
      } else if (order.status === OrderStatus.CANCELLED) {
        needsRefund = true;
      } else if (order.status !== OrderStatus.PAID) {
        throw this.userError("订单状态与支付结果不一致，请人工处理");
      }

      payment.status = PaymentStatus.SUCCESS;
      payment.thirdPartyNo = driverResult.thirdPartyNo ?? payment.thirdPartyNo ?? null;
      payment.paidTime = driverResult.paidAt ?? payment.paidTime ?? new Date();
      await manager.save(payment);
      return { payment, order, paidChanged, needsRefund };
    });

    if (result.paidChanged && result.order) this.orderService.publishPaid(result.order);
    if (result.needsRefund) {
      await this.refund(paymentNo, "订单取消后支付成功，自动原路退款");
      return (
        (await this.paymentRepository.findOne({ where: { paymentNo, isDeleted: 0 } })) ??
        result.payment
      );
    }
    return result.payment;
  }

  private async applyRefundResult(
    paymentNo: string,
    refundNo: string,
    driverResult: PaymentRefundResult
  ): Promise<Refund> {
    if (driverResult.refundNo !== refundNo) {
      throw this.providerError("支付渠道返回的退款单号不一致");
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { paymentNo, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!payment) throw this.userError("支付单不存在");
      const refund = await manager.findOne(Refund, {
        where: { refundNo, paymentId: payment.id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!refund) throw this.userError("退款单不存在");
      if (refund.status === RefundStatus.SUCCESS) {
        return { refund, order: null, changed: false };
      }

      refund.thirdPartyNo = driverResult.thirdPartyNo ?? refund.thirdPartyNo ?? null;
      if (driverResult.status === "PROCESSING") {
        refund.status = RefundStatus.PROCESSING;
        refund.updateTime = new Date();
        await manager.save(refund);
        return { refund, order: null, changed: false };
      }
      if (driverResult.status === "FAILED") {
        refund.status = RefundStatus.FAILED;
        await manager.save(refund);
        return { refund, order: null, changed: false };
      }

      if (!Number.isInteger(driverResult.amount) || driverResult.amount !== refund.amount) {
        throw this.providerError("支付渠道返回退款金额与本地退款单不一致");
      }
      if (payment.status !== PaymentStatus.SUCCESS && payment.status !== PaymentStatus.REFUNDED) {
        throw this.userError("支付状态与退款结果不一致，请人工处理");
      }

      const order = await this.orderService.lockForPayment(manager, payment.orderId);
      let changed = false;
      if (order.status === OrderStatus.PAID) {
        await this.orderService.markRefunded(manager, order);
        changed = true;
      } else if (order.status === OrderStatus.CANCELLED) {
        await this.orderService.markLatePaymentRefunded(manager, order);
        changed = true;
      } else if (order.status !== OrderStatus.REFUNDED) {
        throw this.userError("订单状态与退款结果不一致，请人工处理");
      }

      refund.status = RefundStatus.SUCCESS;
      refund.refundTime = driverResult.refundedAt ?? new Date();
      payment.status = PaymentStatus.REFUNDED;
      await manager.save([refund, payment]);
      return { refund, order, changed };
    });

    if (result.changed && result.order) this.orderService.publishRefunded(result.order);
    return result.refund;
  }

  private async saveNewPayment(
    manager: EntityManager,
    input: Pick<Payment, "orderId" | "memberId" | "amount" | "channel">
  ): Promise<Payment> {
    for (let attempt = 0; attempt < UNIQUE_RETRY_LIMIT; attempt++) {
      const payment = manager.create(Payment, {
        ...input,
        paymentNo: this.nextNo("P"),
        status: PaymentStatus.PENDING,
        isDeleted: 0,
      });
      try {
        return await manager.save(payment);
      } catch (error) {
        if (!this.isDuplicateEntry(error) || attempt === UNIQUE_RETRY_LIMIT - 1) throw error;
      }
    }
    throw new Error("生成唯一支付流水号失败");
  }

  private async saveNewRefund(
    manager: EntityManager,
    payment: Payment,
    reason: string
  ): Promise<Refund> {
    for (let attempt = 0; attempt < UNIQUE_RETRY_LIMIT; attempt++) {
      const refund = manager.create(Refund, {
        refundNo: this.nextNo("R"),
        paymentId: payment.id,
        orderId: payment.orderId,
        memberId: payment.memberId,
        amount: payment.amount,
        reason,
        status: RefundStatus.PROCESSING,
        isDeleted: 0,
      });
      try {
        return await manager.save(refund);
      } catch (error) {
        if (!this.isDuplicateEntry(error) || attempt === UNIQUE_RETRY_LIMIT - 1) throw error;
      }
    }
    throw new Error("生成唯一退款流水号失败");
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
    return `${prefix}${stamp}${randomBytes(8).toString("hex").toUpperCase()}`;
  }

  private driverStatus(status: number): PaymentQueryResult["status"] {
    if (status === PaymentStatus.SUCCESS) return "SUCCESS";
    if (status === PaymentStatus.FAILED) return "FAILED";
    if (status === PaymentStatus.REFUNDED) return "REFUNDED";
    return "PENDING";
  }

  private isDuplicateEntry(error: unknown): boolean {
    const candidate = error as { code?: string; driverError?: { code?: string } };
    return (candidate.driverError?.code ?? candidate.code) === "ER_DUP_ENTRY";
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

  private providerError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.THIRD_PARTY_SERVICE_ERROR, msg });
  }
}
