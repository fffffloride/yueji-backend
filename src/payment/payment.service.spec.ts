import { PaymentService } from "./payment.service";
import { PaymentStatus, RefundStatus } from "./payment-status";
import { PaymentRefundNotFoundError, type PaymentRefundResult } from "./payment-driver";
import { Payment } from "./entities/payment.entity";
import { Refund } from "./entities/refund.entity";
import { Appointment } from "@/appointment/entities/appointment.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { OrderStatus } from "@/order/order-status";

describe("PaymentService", () => {
  const pendingPayment = (overrides: Record<string, unknown> = {}): Record<string, any> => ({
    id: "10",
    paymentNo: "P1",
    orderId: "1",
    memberId: "2",
    payerMemberId: "2",
    amount: 100,
    channel: "mock",
    status: PaymentStatus.PENDING,
    prepayId: "mock-P1",
    expireTime: new Date(Date.now() + 5 * 60_000),
    createTime: new Date(),
    updateTime: new Date(),
    isDeleted: 0,
    ...overrides,
  });

  const paidOrder = (overrides: Record<string, unknown> = {}): Record<string, any> => ({
    id: "1",
    orderNo: "O1",
    memberId: "2",
    beneficiaryMemberId: "2",
    payAmount: 100,
    status: OrderStatus.PAID,
    paidPaymentId: "10",
    createTime: new Date(),
    ...overrides,
  });

  const refundResult = (overrides: Partial<PaymentRefundResult> = {}): PaymentRefundResult => ({
    paymentNo: "P1",
    paymentThirdPartyNo: "WX-P1",
    refundNo: "R1",
    status: "PROCESSING",
    paymentAmount: 100,
    amount: 100,
    currency: "CNY",
    thirdPartyNo: "WX-R1",
    refundChannel: "ORIGINAL",
    userReceivedAccount: "支付用户零钱",
    returnedToMerchant: false,
    ...overrides,
  });

  function setup(
    options: {
      payment?: Record<string, any> | null;
      refund?: Record<string, any> | null;
      order?: Record<string, any>;
      activeAppointment?: boolean;
    } = {}
  ) {
    const state = {
      payments: [] as Record<string, any>[],
      refunds: [] as Record<string, any>[],
      order: options.order ?? paidOrder(),
    };
    if (options.payment !== null) state.payments.push(options.payment ?? pendingPayment());
    if (options.refund) state.refunds.push(options.refund);

    const matches = (row: Record<string, any>, where: Record<string, any> = {}) =>
      Object.entries(where).every(([key, value]) =>
        typeof value === "object" && value !== null
          ? true
          : String(row[key] ?? "") === String(value ?? "")
      );
    const paymentRepository = {
      findOne: jest.fn(
        async ({ where }: any) => state.payments.find((row) => matches(row, where)) ?? null
      ),
      find: jest.fn(async ({ where }: any) => state.payments.filter((row) => matches(row, where))),
    };
    const refundRepository = {
      find: jest.fn(async ({ where }: any) => state.refunds.filter((row) => matches(row, where))),
    };
    let inTransaction = false;
    const driver = {
      create: jest.fn(async (request: any): Promise<any> => ({
        paymentNo: request.paymentNo,
        status: "PENDING",
        prepayId: `mock-${request.paymentNo}`,
        invokeParams: { mock: true, prepayId: `mock-${request.paymentNo}` },
      })),
      buildInvokeParams: jest.fn((prepayId: string) => ({ mock: true, prepayId })),
      query: jest.fn(),
      close: jest.fn(),
      confirmCallback: jest.fn(),
      refund: jest.fn(),
      queryRefund: jest.fn(),
    };
    const lockOrder: string[] = [];
    const manager = {
      findOne: jest.fn(async (entity: unknown, args: any) => {
        if (args?.lock)
          lockOrder.push(entity === Payment ? "payment" : entity === Refund ? "refund" : "other");
        if (entity === Payment)
          return state.payments.find((row) => matches(row, args?.where)) ?? null;
        if (entity === Refund)
          return state.refunds.find((row) => matches(row, args?.where)) ?? null;
        if (entity === Appointment) return options.activeAppointment ? { id: "50" } : null;
        return null;
      }),
      save: jest.fn(async (value: any) => {
        if (Array.isArray(value)) return value;
        if (value?.paymentNo && !state.payments.includes(value)) state.payments.push(value);
        if (value?.refundNo && !state.refunds.includes(value)) state.refunds.push(value);
        return value;
      }),
      create: jest.fn((entity: unknown, value: Record<string, any>) => ({
        id:
          entity === Payment
            ? String(10 + state.payments.length)
            : String(20 + state.refunds.length),
        createTime: new Date(),
        updateTime: new Date(),
        ...value,
      })),
    };
    const dataSource = {
      manager: {
        findOne: jest.fn(async (entity: unknown) => (entity === BizOrder ? state.order : null)),
      },
      transaction: jest.fn(async (work: (value: typeof manager) => unknown) => {
        inTransaction = true;
        try {
          return await work(manager);
        } finally {
          inTransaction = false;
        }
      }),
    };
    const orderService = {
      lockForPayment: jest.fn(async (_manager: unknown, id: string, memberId?: string) => {
        lockOrder.push("order");
        if (String(id) !== String(state.order.id)) throw new Error("missing order");
        if (memberId && String(memberId) !== String(state.order.memberId)) throw new Error("owner");
        return state.order;
      }),
      markPaid: jest.fn(async (_manager: unknown, order: Record<string, any>) => {
        order.status = OrderStatus.PAID;
        return order;
      }),
      markRefunded: jest.fn(async (_manager: unknown, order: Record<string, any>) => {
        order.status = OrderStatus.REFUNDED;
        return order;
      }),
      markLatePaymentRefunded: jest.fn(async (_manager: unknown, order: Record<string, any>) => {
        order.status = OrderStatus.REFUNDED;
        return order;
      }),
      publishPaid: jest.fn(),
      publishRefunded: jest.fn(),
    };
    const orderGiftService = {
      assertRefundAllowed: jest.fn(),
      revokePendingForRefund: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string, fallback: unknown) => {
        if (key === "NODE_ENV") return "dev";
        if (key === "PAYMENT_DRIVER") return "mock";
        if (key === "ORDER_PAY_TIMEOUT_MINUTES") return 30;
        if (key === "PAYMENT_ATTEMPT_LEASE_MINUTES") return 5;
        return fallback;
      }),
    };
    const domainEvents = { on: jest.fn() };
    const service = new PaymentService(
      paymentRepository as never,
      refundRepository as never,
      driver as never,
      config as never,
      dataSource as never,
      orderService as never,
      orderGiftService as never,
      domainEvents as never
    );
    return {
      service,
      state,
      paymentRepository,
      refundRepository,
      driver,
      manager,
      dataSource,
      orderService,
      orderGiftService,
      domainEvents,
      lockOrder,
      isInTransaction: () => inTransaction,
    };
  }

  function enableRefundQueryBuilder(ctx: ReturnType<typeof setup>) {
    (ctx.refundRepository as Record<string, unknown>).createQueryBuilder = jest.fn(() => {
      const parameters: Record<string, unknown> = {};
      const qb: Record<string, jest.Mock> = {};
      const chain = (...args: unknown[]) => {
        const values = args.at(-1);
        if (values && typeof values === "object" && !Array.isArray(values)) {
          Object.assign(parameters, values);
        }
        return qb;
      };
      qb.innerJoin = jest.fn(chain);
      qb.where = jest.fn(chain);
      qb.andWhere = jest.fn(chain);
      qb.orderBy = jest.fn(() => qb);
      qb.addOrderBy = jest.fn(() => qb);
      qb.take = jest.fn(() => qb);
      qb.getMany = jest.fn(async () => {
        const status = parameters.processing ?? parameters.status;
        return ctx.state.refunds.filter(
          (row) => status === undefined || Number(row.status) === Number(status)
        );
      });
      return qb;
    });
  }

  afterEach(() => jest.restoreAllMocks());

  it("新支付尝试分离购买人与付款人，且微信下单发生在事务外", async () => {
    const ctx = setup({
      payment: null,
      order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }),
    });
    ctx.driver.create.mockImplementation(async (request: any) => {
      expect(ctx.isInTransaction()).toBe(false);
      return {
        paymentNo: request.paymentNo,
        status: "PENDING",
        prepayId: "wx-prepay",
        invokeParams: { paySign: "signed" },
      };
    });

    await expect(ctx.service.createForPayer("3", "openid-3", "1", "2")).resolves.toMatchObject({
      amount: 100,
      invokeParams: { paySign: "signed" },
    });
    expect(ctx.state.payments[0]).toMatchObject({ memberId: "2", payerMemberId: "3" });
    expect(ctx.driver.create).toHaveBeenCalledWith(
      expect.objectContaining({ payerOpenid: "openid-3", amount: 100 })
    );
  });

  it("同一付款人复用 prepay，不同付款人不能接管有效尝试", async () => {
    const ctx = setup({ order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }) });

    await expect(ctx.service.create("2", "1", "openid-2")).resolves.toMatchObject({
      paymentNo: "P1",
      invokeParams: { prepayId: "mock-P1" },
    });
    expect(ctx.driver.create).not.toHaveBeenCalled();
    await expect(ctx.service.createForPayer("3", "openid-3", "1", "2")).rejects.toMatchObject({
      response: { msg: "已有好友支付中，请稍后再试" },
    });
  });

  it("仅实际付款人可以查询和模拟确认支付", async () => {
    const ctx = setup({ payment: pendingPayment({ payerMemberId: "3" }) });

    await expect(ctx.service.queryOwned("2", "P1")).rejects.toMatchObject({
      response: { msg: "支付单不存在" },
    });
    await expect(ctx.service.confirmMock("2", "P1")).rejects.toMatchObject({
      response: { msg: "支付单不存在" },
    });
  });

  it("首笔成功原子写入 paidPaymentId，重复通知不重复推进订单", async () => {
    const ctx = setup({ order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }) });
    ctx.driver.confirmCallback.mockResolvedValue({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 100,
      thirdPartyNo: "WX1",
    });

    await ctx.service.confirmMock("2", "P1");
    await ctx.service.applyWechatPaymentNotification({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 100,
      thirdPartyNo: "WX1",
    });

    expect(ctx.state.order.paidPaymentId).toBe("10");
    expect(ctx.state.order.status).toBe(OrderStatus.PAID);
    expect(ctx.orderService.markPaid).toHaveBeenCalledTimes(1);
    expect(ctx.orderService.publishPaid).toHaveBeenCalledTimes(1);
  });

  it("金额不一致时 fail closed", async () => {
    const ctx = setup({ order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }) });

    await expect(
      ctx.service.applyWechatPaymentNotification({
        paymentNo: "P1",
        status: "SUCCESS",
        amount: 99,
        thirdPartyNo: "WX1",
      })
    ).rejects.toBeDefined();
    expect(ctx.orderService.markPaid).not.toHaveBeenCalled();
  });

  it("额外成功支付只落退款意图并快速返回，不修改主订单", async () => {
    const ctx = setup({
      payment: pendingPayment({ payerMemberId: "3" }),
      order: paidOrder({ paidPaymentId: "99" }),
    });
    const immediate = jest.spyOn(global, "setImmediate").mockImplementation((() => 0) as never);
    ctx.driver.confirmCallback.mockResolvedValue({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 100,
    });

    await expect(ctx.service.confirmMock("3", "P1")).resolves.toMatchObject({
      status: PaymentStatus.SUCCESS,
    });

    expect(ctx.state.refunds[0]).toMatchObject({
      paymentId: "10",
      status: RefundStatus.PROCESSING,
      reason: "订单已有其他成功支付，自动原路退款",
    });
    expect(immediate).toHaveBeenCalledTimes(1);
    expect(ctx.orderService.markPaid).not.toHaveBeenCalled();
  });

  it("额外支付退款成功不改变正常主订单", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS, payerMemberId: "3" });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "订单已有其他成功支付，自动原路退款",
      status: RefundStatus.PROCESSING,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund, order: paidOrder({ paidPaymentId: "99" }) });

    await ctx.service.applyWechatRefundNotification("P1", refundResult({ status: "SUCCESS" }));

    expect(payment.status).toBe(PaymentStatus.REFUNDED);
    expect(refund.status).toBe(RefundStatus.SUCCESS);
    expect(ctx.state.order.status).toBe(OrderStatus.PAID);
    expect(ctx.orderService.markRefunded).not.toHaveBeenCalled();
  });

  it("整单退款按 order→payment→refund 加锁，外部调用不持锁", async () => {
    const ctx = setup({ payment: pendingPayment({ status: PaymentStatus.SUCCESS }), refund: null });
    ctx.driver.refund.mockImplementation(async ({ paymentNo, refundNo }: any) => {
      expect(ctx.isInTransaction()).toBe(false);
      return refundResult({ paymentNo, refundNo });
    });

    await expect(ctx.service.refund("P1", "测试退款")).resolves.toMatchObject({
      status: RefundStatus.PROCESSING,
    });

    expect(ctx.lockOrder.slice(0, 2)).toEqual(["order", "payment"]);
    expect(ctx.driver.refund).toHaveBeenCalledTimes(1);
  });

  it("有效预约与退款形成门闩", async () => {
    const ctx = setup({
      payment: pendingPayment({ status: PaymentStatus.SUCCESS }),
      activeAppointment: true,
    });

    await expect(ctx.service.refund("P1", "测试退款")).rejects.toMatchObject({
      response: { msg: "订单已有有效预约，请先取消预约" },
    });
    expect(ctx.driver.refund).not.toHaveBeenCalled();
  });

  it("微信下单期间订单被旧支付完成时不返回新 prepay，并在事务外关单", async () => {
    const ctx = setup({
      payment: null,
      order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }),
    });
    ctx.driver.create.mockImplementation(async (request: any) => {
      ctx.state.order.status = OrderStatus.PAID;
      ctx.state.order.paidPaymentId = "99";
      return { paymentNo: request.paymentNo, status: "PENDING", prepayId: "wx-new" };
    });
    ctx.driver.query.mockResolvedValue({ paymentNo: expect.anything(), status: "PENDING" });
    ctx.driver.query.mockImplementation(async (paymentNo: string) => ({
      paymentNo,
      status: "PENDING",
    }));

    await expect(ctx.service.createForPayer("3", "openid-3", "1", "2")).resolves.toMatchObject({
      invokeParams: null,
      status: PaymentStatus.FAILED,
    });
    expect(ctx.driver.close).toHaveBeenCalledTimes(1);
  });

  it("异付款人恢复过期旧单成功时只得到通用状态错误，不泄露旧流水", async () => {
    const ctx = setup({
      payment: pendingPayment({
        payerMemberId: "2",
        expireTime: new Date(Date.now() - 60_000),
      }),
      order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }),
    });
    ctx.driver.query.mockResolvedValue({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 100,
      thirdPartyNo: "WX-OLD",
    });

    await expect(ctx.service.createForPayer("3", "openid-3", "1", "2")).rejects.toMatchObject({
      response: { msg: "订单状态已更新，请刷新代付页面" },
    });
  });

  it("异付款人关单竞态中旧单成功时仍不泄露旧流水", async () => {
    const payment = pendingPayment({
      payerMemberId: "2",
      expireTime: new Date(Date.now() - 60_000),
    });
    const ctx = setup({
      payment,
      order: paidOrder({ status: OrderStatus.UNPAID, paidPaymentId: null }),
    });
    ctx.driver.query.mockResolvedValue({ paymentNo: "P1", status: "PENDING" });
    ctx.driver.close.mockImplementation(async () => {
      payment.status = PaymentStatus.SUCCESS;
      payment.thirdPartyNo = "WX-LATE";
    });

    await expect(ctx.service.createForPayer("3", "openid-3", "1", "2")).rejects.toMatchObject({
      response: { msg: "订单状态已更新，请刷新代付页面" },
    });
  });

  it("CLOSED 退款换新编号并保留历史，ABNORMAL 只落异常状态", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.CLOSED,
      closedRefundNos: null,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    const rotated = await (ctx.service as any).rotateRefundForRetry(
      payment,
      refund,
      RefundStatus.CLOSED
    );
    expect(rotated.refund.refundNo).not.toBe("R1");
    expect(rotated.refund.closedRefundNos).toBe("R1");
    expect(rotated.refund.status).toBe(RefundStatus.PROCESSING);

    await ctx.service.applyWechatRefundNotification(
      "P1",
      refundResult({ refundNo: rotated.refund.refundNo, status: "ABNORMAL" })
    );
    expect(refund.status).toBe(RefundStatus.ABNORMAL);
    expect(ctx.driver.refund).not.toHaveBeenCalled();
  });

  it("渠道退款成功遇到已履约冲突仍落资金事实，不回滚", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.PROCESSING,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund, order: paidOrder({ status: OrderStatus.COMPLETED }) });

    await expect(
      ctx.service.applyWechatRefundNotification("P1", refundResult({ status: "SUCCESS" }))
    ).resolves.toBeUndefined();
    expect(refund.status).toBe(RefundStatus.SUCCESS);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
    expect(ctx.state.order.status).toBe(OrderStatus.COMPLETED);
  });

  it.each([RefundStatus.CLOSED, RefundStatus.ABNORMAL, RefundStatus.FAILED])(
    "退款终态 %s 不会被迟到 PROCESSING 回调降级",
    async (terminalStatus) => {
      const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
      const refund = {
        id: "20",
        refundNo: "R1",
        paymentId: "10",
        orderId: "1",
        memberId: "2",
        amount: 100,
        reason: "测试退款",
        status: terminalStatus,
        isDeleted: 0,
      };
      const ctx = setup({ payment, refund });

      await ctx.service.applyWechatRefundNotification("P1", refundResult());

      expect(refund.status).toBe(terminalStatus);
    }
  );

  it("重复退款成功通知仍先校验金额和渠道流水", async () => {
    const payment = pendingPayment({ status: PaymentStatus.REFUNDED });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.SUCCESS,
      thirdPartyNo: "WX-R1",
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund, order: paidOrder({ status: OrderStatus.REFUNDED }) });

    await expect(
      ctx.service.applyWechatRefundNotification(
        "P1",
        refundResult({ status: "SUCCESS", amount: 99 })
      )
    ).rejects.toBeDefined();
    await expect(
      ctx.service.applyWechatRefundNotification(
        "P1",
        refundResult({ status: "SUCCESS", thirdPartyNo: "WX-OTHER" })
      )
    ).rejects.toBeDefined();
  });

  it("处理中退款补偿先查单，仅渠道明确不存在时才原参数重提", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "固定原因",
      status: RefundStatus.PROCESSING,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });
    ctx.driver.queryRefund.mockResolvedValue(refundResult());

    await ctx.service.reconcilePending();
    expect(ctx.driver.queryRefund).toHaveBeenCalledWith("R1", "P1");
    expect(ctx.driver.refund).not.toHaveBeenCalled();

    ctx.driver.queryRefund.mockRejectedValueOnce(new PaymentRefundNotFoundError());
    ctx.driver.refund.mockResolvedValue(refundResult());
    await ctx.service.reconcilePending();
    expect(ctx.driver.refund).toHaveBeenCalledWith({
      paymentNo: "P1",
      refundNo: "R1",
      amount: 100,
      reason: "固定原因",
    });
  });

  it("换号后旧 CLOSED 通知不与新 refund_id 冲突且不回退状态", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R2",
      closedRefundNos: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.ABNORMAL,
      thirdPartyNo: "WX-NEW",
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    await ctx.service.applyWechatRefundNotification(
      "P1",
      refundResult({ refundNo: "R1", status: "CLOSED", thirdPartyNo: "WX-OLD" })
    );
    expect(refund).toMatchObject({
      refundNo: "R2",
      status: RefundStatus.ABNORMAL,
      thirdPartyNo: "WX-NEW",
    });
  });

  it("并发换号发现退款已进入 ABNORMAL 时不再提交同号退款", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R2",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.ABNORMAL,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    const rotated = await (ctx.service as any).rotateRefundForRetry(
      payment,
      { ...refund, status: RefundStatus.CLOSED },
      RefundStatus.CLOSED
    );
    expect(rotated).toMatchObject({ shouldSubmit: false, refund });
    expect(ctx.driver.refund).not.toHaveBeenCalled();
  });

  it("提交退款前重读发现已进入 ABNORMAL 时绝不再用同号外调", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.ABNORMAL,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    await expect(
      (ctx.service as any).submitRefundIntent(payment, {
        ...refund,
        status: RefundStatus.PROCESSING,
      })
    ).resolves.toBe(refund);
    expect(ctx.driver.refund).not.toHaveBeenCalled();
  });

  it("ABNORMAL 查单同态会刷新时间，避免旧批次饿死后续异常退款", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const updateTime = new Date("2026-01-01T00:00:00Z");
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.ABNORMAL,
      updateTime,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    await ctx.service.applyWechatRefundNotification("P1", refundResult({ status: "ABNORMAL" }));

    expect(refund.updateTime.getTime()).toBeGreaterThan(updateTime.getTime());
    expect(ctx.manager.save).toHaveBeenCalledWith(refund);
  });

  it("异常退款退回商户银行卡时保持人工态，不完成用户退款义务", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.ABNORMAL,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    await ctx.service.applyWechatRefundNotification(
      "P1",
      refundResult({
        status: "SUCCESS",
        refundChannel: "MERCHANT_BANK_CARD",
        userReceivedAccount: "商户结算银行账户",
        returnedToMerchant: true,
      })
    );

    expect(refund.status).toBe(RefundStatus.ABNORMAL);
    expect(payment.status).toBe(PaymentStatus.SUCCESS);
    expect(ctx.state.order.status).toBe(OrderStatus.PAID);
    expect(ctx.orderService.markRefunded).not.toHaveBeenCalled();
    expect(ctx.orderGiftService.revokePendingForRefund).not.toHaveBeenCalled();
  });

  it("历史退款号迟到成功不覆盖当前退款尝试的渠道流水", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R2",
      closedRefundNos: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.PROCESSING,
      thirdPartyNo: "WX-NEW",
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    await ctx.service.applyWechatRefundNotification(
      "P1",
      refundResult({ refundNo: "R1", status: "SUCCESS", thirdPartyNo: "WX-OLD" })
    );

    expect(refund).toMatchObject({
      status: RefundStatus.SUCCESS,
      thirdPartyNo: "WX-NEW",
    });
  });

  it("渠道退款成功使订单进入退款态时总会撤销待领取赠礼", async () => {
    const payment = pendingPayment({ status: PaymentStatus.PENDING });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.PROCESSING,
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund });

    await ctx.service.applyWechatRefundNotification("P1", refundResult({ status: "SUCCESS" }));

    expect(ctx.state.order.status).toBe(OrderStatus.REFUNDED);
    expect(ctx.orderGiftService.revokePendingForRefund).toHaveBeenCalledWith(ctx.manager, "1");
  });

  it("退款原因超过 UTF-8 80 字节时在落退款意图前拒绝", async () => {
    const ctx = setup({ payment: pendingPayment({ status: PaymentStatus.SUCCESS }) });

    await expect(ctx.service.refund("P1", "退".repeat(27))).rejects.toMatchObject({
      response: { msg: "退款原因不能为空且不能超过80字节" },
    });
    expect(ctx.dataSource.transaction).not.toHaveBeenCalled();
    expect(ctx.driver.refund).not.toHaveBeenCalled();
  });

  it.each([
    ["额外成功支付", paidOrder({ paidPaymentId: "99" })],
    ["取消后迟到支付", paidOrder({ status: OrderStatus.CANCELLED })],
  ])("%s 的自动退款 FAILED 会退避后换号重提", async (_scene, order) => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "相同原因不参与自动退款识别",
      status: RefundStatus.FAILED,
      closedRefundNos: null,
      updateTime: new Date(Date.now() - 120_000),
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund, order });
    enableRefundQueryBuilder(ctx);
    ctx.driver.refund.mockImplementation(async (request: { refundNo: string }) =>
      refundResult({ refundNo: request.refundNo })
    );

    await ctx.service.reconcilePending();

    expect(refund.refundNo).not.toBe("R1");
    expect(refund.closedRefundNos).toBe("R1");
    expect(refund.status).toBe(RefundStatus.PROCESSING);
    expect(ctx.driver.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        refundNo: refund.refundNo,
        reason: "相同原因不参与自动退款识别",
      })
    );
  });

  it("人工发起的 canonical PAID 退款 FAILED 不会被补偿任务自动重提", async () => {
    const payment = pendingPayment({ status: PaymentStatus.SUCCESS });
    const refund = {
      id: "20",
      refundNo: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "相同原因不参与自动退款识别",
      status: RefundStatus.FAILED,
      updateTime: new Date(Date.now() - 120_000),
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund, order: paidOrder() });
    enableRefundQueryBuilder(ctx);

    await ctx.service.reconcilePending();

    expect(refund).toMatchObject({ refundNo: "R1", status: RefundStatus.FAILED });
    expect(ctx.driver.refund).not.toHaveBeenCalled();
  });

  it("用户退款已成功后，历史号退回商户不得破坏资金状态单调性", async () => {
    const payment = pendingPayment({ status: PaymentStatus.REFUNDED });
    const refund = {
      id: "20",
      refundNo: "R2",
      closedRefundNos: "R1",
      paymentId: "10",
      orderId: "1",
      memberId: "2",
      amount: 100,
      reason: "测试退款",
      status: RefundStatus.SUCCESS,
      thirdPartyNo: "WX-NEW",
      refundTime: new Date(),
      isDeleted: 0,
    };
    const ctx = setup({ payment, refund, order: paidOrder({ status: OrderStatus.REFUNDED }) });

    await ctx.service.applyWechatRefundNotification(
      "P1",
      refundResult({
        refundNo: "R1",
        status: "SUCCESS",
        thirdPartyNo: "WX-OLD",
        refundChannel: "MERCHANT_BANK_CARD",
        userReceivedAccount: "商户结算银行账户",
        returnedToMerchant: true,
      })
    );

    expect(refund).toMatchObject({ status: RefundStatus.SUCCESS, thirdPartyNo: "WX-NEW" });
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });
});
