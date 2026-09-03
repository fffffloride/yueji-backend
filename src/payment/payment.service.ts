import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { DataSource, EntityManager, In, Repository } from "typeorm";

import { Payment } from "./entities/payment.entity";
import { Refund } from "./entities/refund.entity";
import {
  PAYMENT_DRIVER,
  PaymentRefundNotFoundError,
  type PaymentDriver,
  type PaymentQueryResult,
  type PaymentRefundResult,
} from "./payment-driver";
import { MIN_PAYMENT_REMAINING_MS, PaymentStatus, RefundStatus } from "./payment-status";
import { BizOrder } from "@/order/entities/order.entity";
import { OrderService } from "@/order/order.service";
import { OrderGiftService } from "@/order/order-gift.service";
import { ORDER_EVENTS, type OrderEventPayload } from "@/order/order.events";
import { OrderStatus } from "@/order/order-status";
import { ACTIVE_ORDER_APPOINTMENT_STATUSES } from "@/appointment/appointment.constants";
import { Appointment } from "@/appointment/entities/appointment.entity";
import { DomainEvents } from "@/common/events/domain-events";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

const UNIQUE_RETRY_LIMIT = 8;
const RECONCILE_BATCH_SIZE = 100;
const CREATE_RECOVERY_GRACE_MS = 10_000;
const TERMINAL_REFUND_RECHECK_DELAY_MS = 60_000;

type PreparedAttempt =
  | { action: "CREATE"; payment: Payment; orderNo: string }
  | { action: "REUSE"; payment: Payment; orderNo: string }
  | { action: "RECOVER"; payment: Payment; orderNo: string };

@Injectable()
export class PaymentService implements OnModuleInit {
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
    private readonly orderService: OrderService,
    private readonly orderGiftService: OrderGiftService,
    private readonly domainEvents: DomainEvents
  ) {}

  onModuleInit(): void {
    this.domainEvents.on<OrderEventPayload>(ORDER_EVENTS.CANCELLED, (event) => {
      void this.closeCancelledOrderPayment(event.orderId).catch((error) =>
        this.logger.warn(`关闭已取消订单的支付失败 orderId=${event.orderId}: ${String(error)}`)
      );
    });
  }

  /** 订单购买人自付；付款人与购买人相同。 */
  async create(memberId: string, orderId: string, payerOpenid = "") {
    return this.createAttempt(memberId, memberId, payerOpenid, orderId);
  }

  /** 好友代付；ownerMemberId 由服务端分享凭证解析，绝不接收客户端购买人 ID。 */
  async createForPayer(
    payerMemberId: string,
    payerOpenid: string,
    orderId: string,
    ownerMemberId: string
  ) {
    return this.createAttempt(ownerMemberId, payerMemberId, payerOpenid, orderId);
  }

  async queryOwned(payerMemberId: string, paymentNo: string) {
    const owned = await this.paymentRepository.findOne({
      where: { paymentNo, payerMemberId, isDeleted: 0 },
    });
    if (!owned) throw this.userError("支付单不存在");

    if (owned.status === PaymentStatus.SUCCESS || owned.status === PaymentStatus.REFUNDED) {
      return {
        ...this.toPaymentVo(owned),
        driverStatus: this.driverStatus(owned.status),
      };
    }
    if (owned.status === PaymentStatus.FAILED) {
      return { ...this.toPaymentVo(owned), driverStatus: "FAILED" as const };
    }

    const driverResult = await this.driver.query(paymentNo);
    const payment = await this.applyPaymentResult(paymentNo, driverResult, payerMemberId);
    const invokeParams =
      payment.status === PaymentStatus.PENDING && payment.prepayId
        ? this.driver.buildInvokeParams(payment.prepayId)
        : undefined;
    return {
      ...this.toPaymentVo(payment, invokeParams),
      driverStatus: driverResult.status,
    };
  }

  async getByOrder(orderId: string) {
    const order = await this.dataSource.manager.findOne(BizOrder, {
      where: { id: orderId, isDeleted: 0 },
    });
    if (!order) throw this.userError("订单不存在");
    const payment = order.paidPaymentId
      ? await this.paymentRepository.findOne({
          where: { id: order.paidPaymentId, orderId, isDeleted: 0 },
        })
      : await this.paymentRepository.findOne({
          where: { orderId, isDeleted: 0 },
          order: { createTime: "DESC", id: "DESC" },
        });
    if (!payment) throw this.userError("支付单不存在");
    return this.toPaymentVo(payment);
  }

  async confirmMock(payerMemberId: string, paymentNo: string) {
    if (this.isProduction()) throw this.userError("生产环境禁止模拟支付确认");

    const owned = await this.paymentRepository.findOne({
      where: { paymentNo, payerMemberId, isDeleted: 0 },
    });
    if (!owned) throw this.userError("支付单不存在");
    if (owned.status === PaymentStatus.SUCCESS || owned.status === PaymentStatus.REFUNDED) {
      return this.toPaymentVo(owned);
    }
    if (owned.status !== PaymentStatus.PENDING) throw this.userError("当前支付单不可确认");

    const confirmed = await this.driver.confirmCallback({
      paymentNo,
      amount: owned.amount,
      success: true,
    });
    if (confirmed.status !== "SUCCESS") throw this.userError("支付确认失败");
    return this.toPaymentVo(await this.applyPaymentResult(paymentNo, confirmed, payerMemberId));
  }

  /** 管理端整单退款，只允许订单真正采用的那笔支付。 */
  async refund(paymentNo: string, reason: string) {
    const normalizedReason = this.normalizeReason(reason);
    const candidate = await this.paymentRepository.findOne({
      where: { paymentNo, isDeleted: 0 },
    });
    if (!candidate) throw this.userError("支付单不存在");

    const prepared = await this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, candidate.orderId);
      const payment = await this.lockPayment(manager, candidate.id);
      this.assertPaymentBelongsToOrder(payment, order);
      if (String(order.paidPaymentId ?? "") !== String(payment.id)) {
        throw this.userError("该支付单不是订单生效支付，不能整单退款");
      }
      const activeAppointment = await manager.findOne(Appointment, {
        where: {
          orderId: order.id,
          status: In(ACTIVE_ORDER_APPOINTMENT_STATUSES),
          isDeleted: 0,
        },
      });
      if (activeAppointment) throw this.userError("订单已有有效预约，请先取消预约");

      let refund = await manager.findOne(Refund, {
        where: { paymentId: payment.id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (refund?.status === RefundStatus.SUCCESS) {
        return { payment, refund, action: "DONE" as const };
      }
      if (payment.status !== PaymentStatus.SUCCESS) {
        throw this.userError("当前支付单不可退款");
      }
      if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.CANCELLED) {
        throw this.userError("仅已付款待核销订单或取消后的迟到支付可退款");
      }
      this.orderGiftService.assertRefundAllowed(order);

      if (refund?.status === RefundStatus.CLOSED) {
        return { payment, refund, action: "ROTATE" as const };
      }
      if (refund?.status === RefundStatus.ABNORMAL) {
        return { payment, refund, action: "QUERY_ONLY" as const };
      }
      if (refund?.status === RefundStatus.FAILED) {
        throw this.userError("退款已失败，请人工核实渠道状态");
      }
      if (refund) {
        // refundNo 是渠道幂等键，受理后不能用同号改变退款原因等请求参数。
        return { payment, refund, action: "CHECK" as const };
      } else {
        refund = await this.saveNewRefund(manager, payment, normalizedReason);
      }
      return { payment, refund, action: "SUBMIT" as const };
    });

    if (prepared.action === "DONE") return prepared.refund;
    if (prepared.action === "ROTATE") {
      const rotated = await this.rotateRefundForRetry(
        prepared.payment,
        prepared.refund,
        RefundStatus.CLOSED
      );
      return rotated.shouldSubmit
        ? this.submitRefundIntent(prepared.payment, rotated.refund)
        : rotated.refund;
    }
    if (prepared.action === "QUERY_ONLY") {
      const result = await this.driver.queryRefund(
        prepared.refund.refundNo,
        prepared.payment.paymentNo
      );
      return this.applyRefundResult(prepared.payment.paymentNo, prepared.refund.refundNo, result);
    }
    if (prepared.action === "CHECK") {
      return this.syncOrSubmitRefundIntent(prepared.payment, prepared.refund);
    }
    return this.submitRefundIntent(prepared.payment, prepared.refund);
  }

  async refundByOrder(orderId: string, reason: string) {
    const order = await this.dataSource.manager.findOne(BizOrder, {
      where: { id: orderId, isDeleted: 0 },
    });
    if (!order?.paidPaymentId) throw this.userError("订单生效支付单不存在");
    const payment = await this.paymentRepository.findOne({
      where: { id: order.paidPaymentId, orderId, isDeleted: 0 },
    });
    if (!payment) throw this.userError("支付单不存在");
    return this.refund(payment.paymentNo, reason);
  }

  /** 已验签、解密的微信支付通知与主动查单共用同一状态应用函数。 */
  async applyWechatPaymentNotification(result: PaymentQueryResult): Promise<void> {
    await this.applyPaymentResult(result.paymentNo, result);
  }

  /** 已验签、解密的微信退款通知与主动查单共用同一状态应用函数。 */
  async applyWechatRefundNotification(
    paymentNo: string,
    result: PaymentRefundResult
  ): Promise<void> {
    await this.applyRefundResult(paymentNo, result.refundNo, result);
  }

  /**
   * 补偿渠道异步结果：待支付查单/过期关单、处理中退款重放、额外成功支付退款。
   * 每项均先释放数据库事务，再调用微信。
   */
  async reconcilePending(limit = RECONCILE_BATCH_SIZE) {
    const batchSize = Math.max(1, Math.min(limit, RECONCILE_BATCH_SIZE));
    let paymentChecked = 0;
    let refundChecked = 0;

    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.PENDING, isDeleted: 0 },
      order: { updateTime: "ASC", id: "ASC" },
      take: batchSize,
    });
    for (const payment of payments) {
      try {
        const result = await this.driver.query(payment.paymentNo);
        await this.applyPaymentResult(payment.paymentNo, result);
        if (
          result.status === "PENDING" &&
          payment.expireTime &&
          payment.expireTime.getTime() <= Date.now()
        ) {
          await this.driver.close(payment.paymentNo);
          await this.markFailedAfterClose(payment.id, payment.orderId);
        }
        paymentChecked += 1;
      } catch (error) {
        this.logger.warn(`同步支付结果失败 paymentId=${payment.id}: ${String(error)}`);
      }
    }

    const refunds = await this.findRefundsForReconcile(batchSize);
    for (const refund of refunds) {
      try {
        const payment = await this.paymentRepository.findOne({
          where: { id: refund.paymentId, isDeleted: 0 },
        });
        if (!payment) throw this.userError("支付单不存在");
        await this.syncOrSubmitRefundIntent(payment, refund);
        refundChecked += 1;
      } catch (error) {
        this.logger.warn(`同步退款结果失败 refundId=${refund.id}: ${String(error)}`);
      }
    }

    for (const refund of await this.findTerminalRefundsForReconcile(
      RefundStatus.CLOSED,
      batchSize
    )) {
      try {
        const payment = await this.paymentRepository.findOne({
          where: { id: refund.paymentId, isDeleted: 0 },
        });
        if (!payment) throw this.userError("支付单不存在");
        const rotated = await this.rotateRefundForRetry(payment, refund, RefundStatus.CLOSED);
        if (rotated.shouldSubmit) await this.submitRefundIntent(payment, rotated.refund);
        refundChecked += 1;
      } catch (error) {
        this.logger.error(`换单重试已关闭退款失败 refundId=${refund.id}: ${String(error)}`);
      }
    }

    for (const refund of await this.findAutomaticFailedRefundsForReconcile(batchSize)) {
      try {
        const payment = await this.paymentRepository.findOne({
          where: { id: refund.paymentId, isDeleted: 0 },
        });
        if (!payment) throw this.userError("支付单不存在");
        const rotated = await this.rotateRefundForRetry(payment, refund, RefundStatus.FAILED);
        if (rotated.shouldSubmit) await this.submitRefundIntent(payment, rotated.refund);
        refundChecked += 1;
      } catch (error) {
        this.logger.error(`换单重试自动退款失败 refundId=${refund.id}: ${String(error)}`);
      }
    }

    for (const refund of await this.findTerminalRefundsForReconcile(
      RefundStatus.ABNORMAL,
      batchSize
    )) {
      try {
        const payment = await this.paymentRepository.findOne({
          where: { id: refund.paymentId, isDeleted: 0 },
        });
        if (!payment) throw this.userError("支付单不存在");
        const result = await this.driver.queryRefund(refund.refundNo, payment.paymentNo);
        await this.applyRefundResult(payment.paymentNo, refund.refundNo, result);
        if (result.status === "ABNORMAL") {
          this.logger.error(
            `微信退款异常，需在商户平台或异常退款接口人工处理 paymentId=${payment.id}, refundId=${refund.id}`
          );
        }
        refundChecked += 1;
      } catch (error) {
        this.logger.error(`查询异常退款失败 refundId=${refund.id}: ${String(error)}`);
      }
    }

    for (const payment of await this.findExtraSuccessfulPayments(batchSize)) {
      try {
        const prepared = await this.ensureExtraPaymentRefund(payment.id, payment.orderId);
        if (prepared) {
          await this.submitRefundIntent(prepared.payment, prepared.refund);
          refundChecked += 1;
        }
      } catch (error) {
        this.logger.warn(`补偿额外成功支付退款失败 paymentId=${payment.id}: ${String(error)}`);
      }
    }
    return { paymentChecked, refundChecked };
  }

  private async createAttempt(
    ownerMemberId: string,
    payerMemberId: string,
    payerOpenid: string,
    orderId: string
  ) {
    for (let pass = 0; pass < 3; pass++) {
      const prepared = await this.prepareAttempt(ownerMemberId, payerMemberId, orderId);
      if (prepared.action === "REUSE") {
        if (!prepared.payment.prepayId) throw this.providerError("支付预下单状态异常");
        return this.toPaymentVo(
          prepared.payment,
          this.driver.buildInvokeParams(prepared.payment.prepayId)
        );
      }
      if (prepared.action === "RECOVER") {
        const recovered = await this.recoverAttempt(prepared.payment, payerMemberId);
        if (recovered) return this.toPaymentVo(recovered);
        continue;
      }

      const created = await this.driver.create({
        paymentNo: prepared.payment.paymentNo,
        orderNo: prepared.orderNo,
        amount: prepared.payment.amount,
        description: `悦己订单 ${prepared.orderNo}`,
        payerOpenid,
        expireAt: prepared.payment.expireTime as Date,
      });
      if (created.paymentNo !== prepared.payment.paymentNo) {
        throw this.providerError("支付渠道返回的支付单号不一致");
      }
      if (created.status === "FAILED") {
        return this.toPaymentVo(
          await this.applyPaymentResult(
            prepared.payment.paymentNo,
            { paymentNo: prepared.payment.paymentNo, status: "FAILED" },
            payerMemberId
          )
        );
      }
      if (created.status === "SUCCESS") {
        const queried = await this.driver.query(prepared.payment.paymentNo);
        return this.toPaymentVo(
          await this.applyPaymentResult(prepared.payment.paymentNo, queried, payerMemberId)
        );
      }
      if (!created.prepayId) throw this.providerError("支付渠道未返回预支付会话");

      const persisted = await this.persistPrepayId(
        prepared.payment.id,
        prepared.payment.orderId,
        created.prepayId
      );
      if (!persisted.canInvoke) {
        const settled = await this.closeUnusableCreatedAttempt(persisted.payment);
        return this.toPaymentVo(settled);
      }
      const invokeParams =
        persisted.payment.status === PaymentStatus.PENDING
          ? (created.invokeParams ?? this.driver.buildInvokeParams(created.prepayId))
          : undefined;
      return this.toPaymentVo(persisted.payment, invokeParams);
    }
    throw this.userError("支付状态正在同步，请稍后重试");
  }

  private async prepareAttempt(
    ownerMemberId: string,
    payerMemberId: string,
    orderId: string
  ): Promise<PreparedAttempt> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, orderId);
      if (String(order.memberId) !== String(ownerMemberId)) {
        throw this.userError("代付分享已失效");
      }
      const now = new Date();
      const orderDeadline = this.orderDeadline(order);
      if (
        order.status !== OrderStatus.UNPAID ||
        order.payAmount <= 0 ||
        orderDeadline.getTime() - now.getTime() < MIN_PAYMENT_REMAINING_MS
      ) {
        throw this.userError("当前订单不可支付或付款时间已结束");
      }

      const active = await manager.findOne(Payment, {
        where: { orderId, status: PaymentStatus.PENDING, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (active) {
        this.assertPaymentBelongsToOrder(active, order);
        const expired = !active.expireTime || active.expireTime.getTime() <= now.getTime();
        const age = now.getTime() - new Date(active.createTime ?? now).getTime();
        if (!expired && active.prepayId) {
          if (String(active.payerMemberId) !== String(payerMemberId)) {
            throw this.userError("已有好友支付中，请稍后再试");
          }
          return { action: "REUSE", payment: active, orderNo: order.orderNo };
        }
        if (!expired && !active.prepayId && age < CREATE_RECOVERY_GRACE_MS) {
          throw this.userError("支付单正在创建，请稍后重试");
        }
        return { action: "RECOVER", payment: active, orderNo: order.orderNo };
      }

      const expireTime = new Date(
        Math.min(
          now.getTime() + this.paymentAttemptLeaseMinutes() * 60_000,
          orderDeadline.getTime()
        )
      );
      const payment = await this.saveNewPayment(manager, {
        orderId: order.id,
        memberId: order.memberId,
        payerMemberId,
        amount: order.payAmount,
        channel: this.driverName(),
        expireTime,
      });
      return { action: "CREATE", payment, orderNo: order.orderNo };
    });
  }

  /** 返回支付记录表示渠道已给出终态；返回 null 表示旧尝试已安全关闭，可新建。 */
  private async recoverAttempt(payment: Payment, payerMemberId: string): Promise<Payment | null> {
    const result = await this.driver.query(payment.paymentNo);
    if (result.status !== "PENDING") {
      const applied = await this.applyPaymentResult(payment.paymentNo, result);
      if (result.status === "FAILED") return null;
      if (String(applied.payerMemberId) !== String(payerMemberId)) {
        throw this.userError("订单状态已更新，请刷新代付页面");
      }
      return applied;
    }
    await this.driver.close(payment.paymentNo);
    await this.markFailedAfterClose(payment.id, payment.orderId);
    const latest = await this.paymentRepository.findOne({
      where: { id: payment.id, isDeleted: 0 },
    });
    if (latest?.status === PaymentStatus.SUCCESS || latest?.status === PaymentStatus.REFUNDED) {
      if (String(latest.payerMemberId) !== String(payerMemberId)) {
        throw this.userError("订单状态已更新，请刷新代付页面");
      }
      return latest;
    }
    if (latest?.status === PaymentStatus.PENDING) {
      throw this.userError(
        String(latest.payerMemberId) === String(payerMemberId)
          ? "支付状态正在同步，请稍后重试"
          : "已有好友支付中，请稍后再试"
      );
    }
    return null;
  }

  private async persistPrepayId(paymentId: string, orderId: string, prepayId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, orderId);
      const payment = await this.lockPayment(manager, paymentId);
      this.assertPaymentBelongsToOrder(payment, order);
      if (payment.status === PaymentStatus.PENDING) {
        if (payment.prepayId && payment.prepayId !== prepayId) {
          throw this.providerError("支付预下单会话不一致");
        }
        payment.prepayId = prepayId;
        await manager.save(payment);
      }
      return {
        payment,
        canInvoke:
          payment.status === PaymentStatus.PENDING &&
          order.status === OrderStatus.UNPAID &&
          !order.paidPaymentId,
      };
    });
  }

  /** 微信下单期间订单已终态，绝不把调起参数交给客户端；事务外查单、关单。 */
  private async closeUnusableCreatedAttempt(payment: Payment): Promise<Payment> {
    if (payment.status !== PaymentStatus.PENDING) return payment;
    const result = await this.driver.query(payment.paymentNo);
    if (result.status === "PENDING") {
      await this.driver.close(payment.paymentNo);
      await this.markFailedAfterClose(payment.id, payment.orderId);
    } else {
      await this.applyPaymentResult(payment.paymentNo, result);
    }
    return (
      (await this.paymentRepository.findOne({ where: { id: payment.id, isDeleted: 0 } })) ?? payment
    );
  }

  private async markFailedAfterClose(paymentId: string, orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, orderId);
      const payment = await this.lockPayment(manager, paymentId);
      this.assertPaymentBelongsToOrder(payment, order);
      if (payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.FAILED;
        await manager.save(payment);
      }
    });
  }

  private async applyPaymentResult(
    paymentNo: string,
    driverResult: PaymentQueryResult,
    payerMemberId?: string
  ): Promise<Payment> {
    if (driverResult.paymentNo !== paymentNo) {
      throw this.providerError("支付渠道返回的支付单号不一致");
    }
    const candidate = await this.paymentRepository.findOne({
      where: { paymentNo, isDeleted: 0 },
    });
    if (
      !candidate ||
      (payerMemberId && String(candidate.payerMemberId) !== String(payerMemberId))
    ) {
      throw this.userError("支付单不存在");
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, candidate.orderId);
      const payment = await this.lockPayment(manager, candidate.id);
      this.assertPaymentBelongsToOrder(payment, order);
      if (payerMemberId && String(payment.payerMemberId) !== String(payerMemberId)) {
        throw this.userError("支付单不存在");
      }

      if (driverResult.status === "PENDING") {
        if (payment.status === PaymentStatus.PENDING) {
          payment.updateTime = new Date();
          await manager.save(payment);
        }
        return { payment, order: null, paidChanged: false, refund: null };
      }
      if (driverResult.status === "FAILED") {
        if (payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.FAILED;
          await manager.save(payment);
        }
        return { payment, order: null, paidChanged: false, refund: null };
      }
      if (driverResult.status === "REFUNDED") {
        if (payment.status !== PaymentStatus.REFUNDED) {
          throw this.providerError("渠道支付已退款，但本地退款单尚未完成同步");
        }
        return { payment, order: null, paidChanged: false, refund: null };
      }
      if (!Number.isInteger(driverResult.amount) || driverResult.amount !== payment.amount) {
        throw this.providerError("支付渠道返回金额与本地支付单不一致");
      }
      if (
        payment.thirdPartyNo &&
        driverResult.thirdPartyNo &&
        payment.thirdPartyNo !== driverResult.thirdPartyNo
      ) {
        throw this.providerError("支付渠道流水号与本地记录不一致");
      }
      if (payment.status === PaymentStatus.REFUNDED) {
        return { payment, order: null, paidChanged: false, refund: null };
      }

      payment.status = PaymentStatus.SUCCESS;
      payment.thirdPartyNo = driverResult.thirdPartyNo ?? payment.thirdPartyNo ?? null;
      payment.paidTime = driverResult.paidAt ?? payment.paidTime ?? new Date();
      await manager.save(payment);

      let paidChanged = false;
      let needsRefund = false;
      if (order.status === OrderStatus.UNPAID && !order.paidPaymentId) {
        order.paidPaymentId = payment.id;
        await this.orderService.markPaid(
          manager,
          order,
          payment.paidTime,
          payment.channel === "wechat" ? 1 : 2
        );
        paidChanged = true;
      } else if (order.status === OrderStatus.CANCELLED && !order.paidPaymentId) {
        // 取消后才收到成功结果：记录主支付，退款完成后走 CANCELLED -> REFUNDED。
        order.paidPaymentId = payment.id;
        await manager.save(order);
        needsRefund = true;
      } else if (String(order.paidPaymentId ?? "") !== String(payment.id)) {
        if (!order.paidPaymentId && order.status !== OrderStatus.UNPAID) {
          throw this.providerError("订单缺少生效支付关联，请人工处理");
        }
        needsRefund = true;
      }

      const refund = needsRefund
        ? await this.ensureRefundIntent(
            manager,
            payment,
            order.status === OrderStatus.CANCELLED
              ? "订单取消后支付成功，自动原路退款"
              : "订单已有其他成功支付，自动原路退款"
          )
        : null;
      return { payment, order, paidChanged, refund };
    });

    if (result.paidChanged && result.order) this.orderService.publishPaid(result.order);
    if (result.refund?.status === RefundStatus.PROCESSING) {
      this.queueRefund(result.payment, result.refund);
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
    if (driverResult.paymentNo !== paymentNo) {
      throw this.providerError("支付渠道返回的退款所属支付单不一致");
    }
    const candidate = await this.paymentRepository.findOne({
      where: { paymentNo, isDeleted: 0 },
    });
    if (!candidate) throw this.userError("支付单不存在");

    const result = await this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, candidate.orderId);
      const payment = await this.lockPayment(manager, candidate.id);
      this.assertPaymentBelongsToOrder(payment, order);
      const refund = await manager.findOne(Refund, {
        where: { paymentId: payment.id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!refund) throw this.userError("退款单不存在");
      const historicalRefundNos = (refund.closedRefundNos ?? "").split(",").filter(Boolean);
      const isCurrentRefundNo = refund.refundNo === refundNo;
      if (!isCurrentRefundNo && !historicalRefundNos.includes(refundNo)) {
        throw this.providerError("支付渠道返回的退款单号与本地退款意图不一致");
      }
      if (payment.thirdPartyNo && payment.thirdPartyNo !== driverResult.paymentThirdPartyNo) {
        throw this.providerError("支付渠道退款关联的微信支付流水号不一致");
      }
      if (
        !Number.isInteger(driverResult.paymentAmount) ||
        driverResult.paymentAmount !== payment.amount ||
        !Number.isInteger(driverResult.amount) ||
        driverResult.amount !== refund.amount ||
        driverResult.currency !== "CNY"
      ) {
        throw this.providerError("支付渠道返回退款金额或币种与本地资金记录不一致");
      }
      // 换号后旧退款单的迟到非成功通知只做幂等确认，绝不与当前尝试的 refund_id 比较。
      if (!isCurrentRefundNo && driverResult.status !== "SUCCESS") {
        return { refund, order: null, changed: false, conflict: false };
      }
      if (
        isCurrentRefundNo &&
        refund.thirdPartyNo &&
        driverResult.thirdPartyNo &&
        refund.thirdPartyNo !== driverResult.thirdPartyNo
      ) {
        throw this.providerError("支付渠道退款流水号与本地记录不一致");
      }
      if (refund.status === RefundStatus.SUCCESS) {
        return { refund, order: null, changed: false, conflict: false };
      }
      if (!isCurrentRefundNo) {
        this.logger.error(
          `已换号历史退款单返回成功，按资金事实完成退款，需核对新旧退款尝试 paymentId=${payment.id}, refundId=${refund.id}`
        );
      }
      if (driverResult.returnedToMerchant) {
        refund.status = RefundStatus.ABNORMAL;
        refund.thirdPartyNo = isCurrentRefundNo
          ? (driverResult.thirdPartyNo ?? refund.thirdPartyNo ?? null)
          : (refund.thirdPartyNo ?? null);
        refund.refundTime = null;
        refund.updateTime = new Date();
        if (payment.status === PaymentStatus.REFUNDED) payment.status = PaymentStatus.SUCCESS;
        await manager.save([refund, payment]);
        this.logger.error(
          `异常退款资金退至商户账户，用户退款义务未完成，需人工处理 paymentId=${payment.id}, refundId=${refund.id}`
        );
        return { refund, order: null, changed: false, conflict: true };
      }

      // SUCCESS 是资金事实，可从任意非成功状态落账；其他渠道状态只能从 PROCESSING 前进。
      if (driverResult.status !== "SUCCESS" && refund.status !== RefundStatus.PROCESSING) {
        if (driverResult.status === "ABNORMAL" && refund.status === RefundStatus.ABNORMAL) {
          refund.updateTime = new Date();
          await manager.save(refund);
        }
        return { refund, order: null, changed: false, conflict: false };
      }
      refund.thirdPartyNo = isCurrentRefundNo
        ? (driverResult.thirdPartyNo ?? refund.thirdPartyNo ?? null)
        : (refund.thirdPartyNo ?? null);
      if (driverResult.status !== "SUCCESS") {
        refund.status = this.refundStatusFromDriver(driverResult.status);
        if (refund.status === RefundStatus.PROCESSING) refund.updateTime = new Date();
        await manager.save(refund);
        return { refund, order: null, changed: false, conflict: false };
      }
      const canonical = String(order.paidPaymentId ?? "") === String(payment.id);
      let changed = false;
      let conflict =
        payment.status !== PaymentStatus.SUCCESS && payment.status !== PaymentStatus.REFUNDED;
      if (canonical) {
        if (order.status === OrderStatus.PAID) {
          await this.orderService.markRefunded(manager, order);
          changed = true;
        } else if (order.status === OrderStatus.CANCELLED) {
          await this.orderService.markLatePaymentRefunded(manager, order);
          changed = true;
        } else if (order.status !== OrderStatus.REFUNDED) {
          // 渠道退款已成功是资金事实，不能因本地履约冲突回滚；保留订单供人工修复。
          conflict = true;
        }
        // 只要订单已经进入退款态，就必须撤销未领取赠礼；支付记录冲突另行告警但不应留下权益入口。
        if (order.status === OrderStatus.REFUNDED) {
          await this.orderGiftService.revokePendingForRefund(manager, order.id);
        }
      }

      refund.status = RefundStatus.SUCCESS;
      refund.refundTime = driverResult.refundedAt ?? new Date();
      payment.status = PaymentStatus.REFUNDED;
      await manager.save([refund, payment]);
      return { refund, order: canonical ? order : null, changed, conflict };
    });

    if (result.changed && result.order) this.orderService.publishRefunded(result.order);
    if (result.conflict) {
      this.logger.error(
        `渠道退款已成功但本地支付/履约状态冲突，资金事实已落账，需人工修复 paymentId=${candidate.id}, refundId=${result.refund.id}`
      );
    }
    if (driverResult.status === "ABNORMAL") {
      this.logger.error(
        `微信退款进入异常状态，禁止同号重申，需人工处理 paymentId=${candidate.id}, refundId=${result.refund.id}`
      );
    }
    return result.refund;
  }

  private async closeCancelledOrderPayment(orderId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId, status: PaymentStatus.PENDING, isDeleted: 0 },
    });
    if (!payment) return;
    const result = await this.driver.query(payment.paymentNo);
    if (result.status === "PENDING") {
      await this.driver.close(payment.paymentNo);
      await this.markFailedAfterClose(payment.id, payment.orderId);
      return;
    }
    await this.applyPaymentResult(payment.paymentNo, result);
  }

  private async submitRefundIntent(payment: Payment, refund: Refund): Promise<Refund> {
    const prepared = await this.prepareRefundSubmission(payment, refund);
    if (!prepared.request) return prepared.refund;
    const result = await this.driver.refund(prepared.request);
    return this.applyRefundResult(prepared.payment.paymentNo, prepared.refund.refundNo, result);
  }

  /** 外调前按 order→payment→refund 重读，终态或已换号时绝不再向渠道提交。 */
  private async prepareRefundSubmission(paymentCandidate: Payment, refundCandidate: Refund) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, paymentCandidate.orderId);
      const payment = await this.lockPayment(manager, paymentCandidate.id);
      this.assertPaymentBelongsToOrder(payment, order);
      const refund = await manager.findOne(Refund, {
        where: { paymentId: payment.id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!refund || String(refund.id) !== String(refundCandidate.id)) {
        throw this.providerError("退款意图与支付记录关联不一致");
      }
      if (
        payment.status !== PaymentStatus.SUCCESS ||
        refund.status !== RefundStatus.PROCESSING ||
        refund.refundNo !== refundCandidate.refundNo
      ) {
        return { payment, refund, request: null };
      }
      return {
        payment,
        refund,
        request: {
          paymentNo: payment.paymentNo,
          refundNo: refund.refundNo,
          amount: refund.amount,
          reason: refund.reason,
        },
      };
    });
  }

  private async syncOrSubmitRefundIntent(payment: Payment, refund: Refund): Promise<Refund> {
    try {
      const result = await this.driver.queryRefund(refund.refundNo, payment.paymentNo);
      return this.applyRefundResult(payment.paymentNo, refund.refundNo, result);
    } catch (error) {
      if (!(error instanceof PaymentRefundNotFoundError)) throw error;
      return this.submitRefundIntent(payment, refund);
    }
  }

  private queueRefund(payment: Payment, refund: Refund): void {
    setImmediate(() => {
      void this.submitRefundIntent(payment, refund).catch((error) =>
        this.logger.warn(`自动退款提交失败 paymentId=${payment.id}: ${String(error)}`)
      );
    });
  }

  private async ensureExtraPaymentRefund(paymentId: string, orderId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, orderId);
      const payment = await this.lockPayment(manager, paymentId);
      this.assertPaymentBelongsToOrder(payment, order);
      if (
        payment.status !== PaymentStatus.SUCCESS ||
        String(order.paidPaymentId ?? "") === String(payment.id)
      ) {
        return null;
      }
      const refund = await this.ensureRefundIntent(
        manager,
        payment,
        "订单已有其他成功支付，自动原路退款"
      );
      return { payment, refund };
    });
  }

  private async ensureRefundIntent(
    manager: EntityManager,
    payment: Payment,
    reason: string
  ): Promise<Refund> {
    const existing = await manager.findOne(Refund, {
      where: { paymentId: payment.id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (existing) {
      return existing;
    }
    return this.saveNewRefund(manager, payment, reason);
  }

  private async findExtraSuccessfulPayments(limit: number): Promise<Payment[]> {
    if (typeof this.paymentRepository.createQueryBuilder !== "function") return [];
    return this.paymentRepository
      .createQueryBuilder("payment")
      .innerJoin(BizOrder, "orders", "orders.id = payment.order_id AND orders.is_deleted = 0")
      .leftJoin(Refund, "refund", "refund.payment_id = payment.id AND refund.is_deleted = 0")
      .where("payment.status = :status", { status: PaymentStatus.SUCCESS })
      .andWhere("payment.is_deleted = 0")
      .andWhere("(orders.paid_payment_id IS NULL OR orders.paid_payment_id <> payment.id)")
      .andWhere("refund.id IS NULL")
      .orderBy("payment.update_time", "ASC")
      .addOrderBy("payment.id", "ASC")
      .take(limit)
      .getMany();
  }

  private async findRefundsForReconcile(limit: number): Promise<Refund[]> {
    if (typeof this.refundRepository.createQueryBuilder !== "function") {
      return this.refundRepository.find({
        where: { status: RefundStatus.PROCESSING, isDeleted: 0 },
        order: { updateTime: "ASC", id: "ASC" },
        take: limit,
      });
    }
    return this.refundRepository
      .createQueryBuilder("refund")
      .where("refund.is_deleted = 0")
      .andWhere("refund.status = :processing", { processing: RefundStatus.PROCESSING })
      .orderBy("refund.update_time", "ASC")
      .addOrderBy("refund.id", "ASC")
      .take(limit)
      .getMany();
  }

  private async findTerminalRefundsForReconcile(status: number, limit: number): Promise<Refund[]> {
    if (typeof this.refundRepository.createQueryBuilder !== "function") return [];
    return this.refundRepository
      .createQueryBuilder("refund")
      .where("refund.is_deleted = 0")
      .andWhere("refund.status = :status", { status })
      .andWhere("refund.update_time < :retryBefore", {
        retryBefore: new Date(Date.now() - TERMINAL_REFUND_RECHECK_DELAY_MS),
      })
      .orderBy("refund.update_time", "ASC")
      .addOrderBy("refund.id", "ASC")
      .take(limit)
      .getMany();
  }

  /** 只补偿系统自动退款；人工发起的主订单退款失败后继续开放履约，绝不自动重试。 */
  private async findAutomaticFailedRefundsForReconcile(limit: number): Promise<Refund[]> {
    if (typeof this.refundRepository.createQueryBuilder !== "function") return [];
    return this.refundRepository
      .createQueryBuilder("refund")
      .innerJoin(
        Payment,
        "payment",
        "payment.id = refund.payment_id AND payment.is_deleted = 0 AND payment.status = :paymentSuccess",
        { paymentSuccess: PaymentStatus.SUCCESS }
      )
      .innerJoin(BizOrder, "orders", "orders.id = refund.order_id AND orders.is_deleted = 0")
      .where("refund.is_deleted = 0")
      .andWhere("refund.status = :status", { status: RefundStatus.FAILED })
      .andWhere("refund.update_time < :retryBefore", {
        retryBefore: new Date(Date.now() - TERMINAL_REFUND_RECHECK_DELAY_MS),
      })
      .andWhere(
        `(orders.paid_payment_id IS NULL OR orders.paid_payment_id <> payment.id
          OR (orders.paid_payment_id = payment.id AND orders.status = :cancelled))`,
        { cancelled: OrderStatus.CANCELLED }
      )
      .orderBy("refund.update_time", "ASC")
      .addOrderBy("refund.id", "ASC")
      .take(limit)
      .getMany();
  }

  /** CLOSED 或系统自动退款 FAILED 必须换 out_refund_no；历史编号保留用于审计。 */
  private async rotateRefundForRetry(
    paymentCandidate: Payment,
    refundCandidate: Refund,
    expectedStatus: typeof RefundStatus.CLOSED | typeof RefundStatus.FAILED
  ) {
    const rotated = await this.dataSource.transaction(async (manager) => {
      const order = await this.orderService.lockForPayment(manager, paymentCandidate.orderId);
      const payment = await this.lockPayment(manager, paymentCandidate.id);
      this.assertPaymentBelongsToOrder(payment, order);
      const refund = await manager.findOne(Refund, {
        where: { id: refundCandidate.id, paymentId: payment.id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!refund) throw this.userError("退款单不存在");
      if (refund.status !== expectedStatus) {
        return { refund, shouldSubmit: false as const };
      }
      if (expectedStatus === RefundStatus.FAILED) {
        const canonical = String(order.paidPaymentId ?? "") === String(payment.id);
        const isAutomaticRetry = !canonical || order.status === OrderStatus.CANCELLED;
        if (payment.status !== PaymentStatus.SUCCESS || !isAutomaticRetry) {
          return { refund, shouldSubmit: false as const };
        }
      }

      const history = (refund.closedRefundNos ?? "").split(",").filter(Boolean);
      history.push(refund.refundNo);
      refund.closedRefundNos = history.slice(-30).join(",");
      refund.thirdPartyNo = null;
      refund.refundTime = null;
      refund.status = RefundStatus.PROCESSING;
      for (let attempt = 0; attempt < UNIQUE_RETRY_LIMIT; attempt++) {
        refund.refundNo = this.nextNo("R");
        try {
          return { refund: await manager.save(refund), shouldSubmit: true as const };
        } catch (error) {
          if (!this.isDuplicateEntry(error) || attempt === UNIQUE_RETRY_LIMIT - 1) throw error;
        }
      }
      throw new Error("生成唯一退款流水号失败");
    });
    if (rotated.shouldSubmit) {
      this.logger.warn(
        `${expectedStatus === RefundStatus.CLOSED ? "微信退款已关闭" : "系统自动退款被渠道拒绝"}，已换新商户退款单号重试 paymentId=${paymentCandidate.id}, refundId=${refundCandidate.id}`
      );
    }
    return rotated;
  }

  private refundStatusFromDriver(
    status: Exclude<PaymentRefundResult["status"], "SUCCESS">
  ): number {
    switch (status) {
      case "PROCESSING":
        return RefundStatus.PROCESSING;
      case "FAILED":
        return RefundStatus.FAILED;
      case "CLOSED":
        return RefundStatus.CLOSED;
      case "ABNORMAL":
        return RefundStatus.ABNORMAL;
    }
  }

  private async lockPayment(manager: EntityManager, id: string): Promise<Payment> {
    const payment = await manager.findOne(Payment, {
      where: { id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!payment) throw this.userError("支付单不存在");
    return payment;
  }

  private assertPaymentBelongsToOrder(payment: Payment, order: BizOrder): void {
    if (
      String(payment.orderId) !== String(order.id) ||
      String(payment.memberId) !== String(order.memberId)
    ) {
      throw this.providerError("支付单与订单关联不一致");
    }
  }

  private async saveNewPayment(
    manager: EntityManager,
    input: Pick<
      Payment,
      "orderId" | "memberId" | "payerMemberId" | "amount" | "channel" | "expireTime"
    >
  ): Promise<Payment> {
    for (let attempt = 0; attempt < UNIQUE_RETRY_LIMIT; attempt++) {
      const payment = manager.create(Payment, {
        ...input,
        paymentNo: this.nextNo("P"),
        prepayId: null,
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

  private orderDeadline(order: BizOrder): Date {
    const createdAt = new Date(order.createTime ?? new Date());
    return new Date(createdAt.getTime() + this.orderPayTimeoutMinutes() * 60_000);
  }

  private orderPayTimeoutMinutes(): number {
    return Number(this.configService.get<number>("ORDER_PAY_TIMEOUT_MINUTES", 30));
  }

  private paymentAttemptLeaseMinutes(): number {
    return Number(this.configService.get<number>("PAYMENT_ATTEMPT_LEASE_MINUTES", 5));
  }

  private normalizeReason(reason: string): string {
    const normalized = reason.trim();
    if (!normalized || Buffer.byteLength(normalized, "utf8") > 80) {
      throw this.userError("退款原因不能为空且不能超过80字节");
    }
    return normalized;
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
