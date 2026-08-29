import { PaymentService } from "./payment.service";
import { PaymentStatus, RefundStatus } from "./payment-status";
import { Payment } from "./entities/payment.entity";
import { Refund } from "./entities/refund.entity";
import { OrderStatus } from "@/order/order-status";

describe("PaymentService", () => {
  const pendingPayment = (): Record<string, any> => ({
    id: "10",
    paymentNo: "P1",
    orderId: "1",
    memberId: "2",
    amount: 100,
    channel: "mock",
    status: PaymentStatus.PENDING,
    isDeleted: 0,
    updateTime: new Date(),
  });

  const paidOrder = (): Record<string, any> => ({
    id: "1",
    orderNo: "O1",
    memberId: "2",
    payAmount: 100,
    status: OrderStatus.PAID,
  });

  function setup(options?: {
    payment?: ReturnType<typeof pendingPayment>;
    refund?: Record<string, any> | null;
    order?: ReturnType<typeof paidOrder>;
  }) {
    const payment = options?.payment ?? pendingPayment();
    const refund =
      options && Object.prototype.hasOwnProperty.call(options, "refund")
        ? options.refund
        : {
            id: "20",
            refundNo: "R1",
            paymentId: payment.id,
            orderId: payment.orderId,
            memberId: payment.memberId,
            amount: payment.amount,
            reason: "测试退款",
            status: RefundStatus.PROCESSING,
            isDeleted: 0,
            updateTime: new Date(),
          };
    const order = options?.order ?? paidOrder();
    const paymentRepository = { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    const refundRepository = { find: jest.fn().mockResolvedValue([]) };
    const driver = {
      create: jest.fn().mockResolvedValue({
        paymentNo: payment.paymentNo,
        status: "PENDING",
        invokeParams: { mock: true },
      }),
      query: jest.fn(),
      confirmCallback: jest.fn(),
      refund: jest.fn(),
      queryRefund: jest.fn(),
    };
    const manager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === Payment) return Promise.resolve(payment);
        if (entity === Refund) return Promise.resolve(refund);
        return Promise.resolve(null);
      }),
      save: jest.fn(async (value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    let inTransaction = false;
    const dataSource = {
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
      lockForPayment: jest.fn().mockResolvedValue(order),
      markPaid: jest.fn(),
      markRefunded: jest.fn(),
      markLatePaymentRefunded: jest.fn(),
      publishPaid: jest.fn(),
      publishRefunded: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string, fallback: string) => {
        if (key === "NODE_ENV") return "dev";
        if (key === "PAYMENT_DRIVER") return "mock";
        return fallback;
      }),
    };
    const service = new PaymentService(
      paymentRepository as never,
      refundRepository as never,
      driver as never,
      config as never,
      dataSource as never,
      orderService as never
    );
    return {
      service,
      payment,
      refund,
      order,
      paymentRepository,
      refundRepository,
      driver,
      manager,
      dataSource,
      orderService,
      isInTransaction: () => inTransaction,
    };
  }

  it("重复创建复用同一支付号并在事务外重新取得调起参数", async () => {
    const ctx = setup({ order: { ...paidOrder(), status: OrderStatus.UNPAID } });
    ctx.driver.create.mockImplementation(async () => {
      expect(ctx.isInTransaction()).toBe(false);
      return { paymentNo: "P1", status: "PENDING", invokeParams: { mock: true } };
    });

    await expect(ctx.service.create("2", "1")).resolves.toMatchObject({
      paymentNo: "P1",
      invokeParams: { mock: true },
    });
    expect(ctx.driver.create).toHaveBeenCalledWith(expect.objectContaining({ paymentNo: "P1" }));
  });

  it("支付流水号唯一冲突时重新生成并有限重试", async () => {
    const ctx = setup({ refund: null, order: { ...paidOrder(), status: OrderStatus.UNPAID } });
    ctx.manager.findOne.mockResolvedValue(null);
    ctx.manager.save
      .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" })
      .mockImplementation(async (value: Record<string, unknown>) => ({ id: "10", ...value }));
    ctx.driver.create.mockImplementation(async (request: { paymentNo: string }) => ({
      paymentNo: request.paymentNo,
      status: "PENDING",
    }));

    await expect(ctx.service.create("2", "1")).resolves.toMatchObject({ amount: 100 });
    expect(ctx.manager.save).toHaveBeenCalledTimes(2);
    const generated = ctx.manager.create.mock.calls.map((call) =>
      String((call[1] as Record<string, unknown>).paymentNo)
    );
    expect(generated[0]).not.toBe(generated[1]);
  });

  it("已成功支付重复确认不再次调用渠道或推进订单", async () => {
    const payment = { ...pendingPayment(), status: PaymentStatus.SUCCESS };
    const ctx = setup({ payment });
    ctx.paymentRepository.findOne.mockResolvedValue(payment);

    await expect(ctx.service.confirmMock("2", "P1")).resolves.toMatchObject({
      status: PaymentStatus.SUCCESS,
    });
    expect(ctx.driver.confirmCallback).not.toHaveBeenCalled();
    expect(ctx.orderService.markPaid).not.toHaveBeenCalled();
  });

  it("支付成功金额不一致时拒绝推进订单", async () => {
    const ctx = setup({ order: { ...paidOrder(), status: OrderStatus.UNPAID } });
    ctx.paymentRepository.findOne.mockResolvedValue(ctx.payment);
    ctx.driver.confirmCallback.mockResolvedValue({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 99,
    });

    await expect(ctx.service.confirmMock("2", "P1")).rejects.toBeDefined();
    expect(ctx.orderService.markPaid).not.toHaveBeenCalled();
  });

  it("渠道退款调用在事务外执行且 PROCESSING 状态保留", async () => {
    const payment = { ...pendingPayment(), status: PaymentStatus.SUCCESS };
    const ctx = setup({ payment });
    ctx.driver.refund.mockImplementation(async () => {
      expect(ctx.isInTransaction()).toBe(false);
      return { refundNo: "R1", status: "PROCESSING" };
    });

    await expect(ctx.service.refund("P1", " 测试退款 ")).resolves.toMatchObject({
      refundNo: "R1",
      status: RefundStatus.PROCESSING,
    });
    expect(ctx.driver.refund).toHaveBeenCalledWith(
      expect.objectContaining({ refundNo: "R1", reason: "测试退款" })
    );
    expect(ctx.orderService.markRefunded).not.toHaveBeenCalled();
  });

  it("渠道网络失败后重试仍复用已持久化的退款号", async () => {
    const payment = { ...pendingPayment(), status: PaymentStatus.SUCCESS };
    const ctx = setup({ payment });
    ctx.driver.refund.mockRejectedValue(new Error("network"));

    await expect(ctx.service.refund("P1", "测试退款")).rejects.toThrow("network");
    await expect(ctx.service.refund("P1", "再次退款")).rejects.toThrow("network");
    expect(ctx.driver.refund).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ refundNo: "R1" })
    );
    expect(ctx.driver.refund).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ refundNo: "R1" })
    );
  });

  it("退款成功后在独立事务推进订单与支付终态", async () => {
    const payment = { ...pendingPayment(), status: PaymentStatus.SUCCESS };
    const ctx = setup({ payment });
    ctx.driver.refund.mockResolvedValue({ refundNo: "R1", status: "SUCCESS", amount: 100 });

    await expect(ctx.service.refund("P1", "测试退款")).resolves.toMatchObject({
      status: RefundStatus.SUCCESS,
    });
    expect(ctx.orderService.markRefunded).toHaveBeenCalledTimes(1);
    expect(ctx.orderService.publishRefunded).toHaveBeenCalledTimes(1);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it("补偿任务使用原退款号安全重放未完成退款", async () => {
    const payment = { ...pendingPayment(), status: PaymentStatus.SUCCESS };
    const ctx = setup({ payment });
    ctx.refundRepository.find.mockResolvedValue([ctx.refund]);
    ctx.paymentRepository.findOne.mockResolvedValue(payment);
    ctx.driver.refund.mockResolvedValue({ refundNo: "R1", status: "PROCESSING" });

    await expect(ctx.service.reconcilePending()).resolves.toEqual({
      paymentChecked: 0,
      refundChecked: 1,
    });
    expect(ctx.driver.refund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentNo: "P1", refundNo: "R1", amount: 100 })
    );
  });

  it("订单取消后收到迟到支付时自动退款且不重复回补库存", async () => {
    const payment = pendingPayment();
    const order: Record<string, any> = { ...paidOrder(), status: OrderStatus.CANCELLED };
    const ctx = setup({ payment, refund: null, order });
    let refund: Record<string, any> | null = null;
    ctx.paymentRepository.findOne.mockResolvedValue(payment);
    ctx.manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Payment) return Promise.resolve(payment);
      if (entity === Refund) return Promise.resolve(refund);
      return Promise.resolve(null);
    });
    ctx.manager.create.mockImplementation((entity: unknown, value: Record<string, any>) => {
      if (entity === Refund) {
        refund = { id: "20", ...value };
        return refund;
      }
      return value;
    });
    ctx.driver.confirmCallback.mockResolvedValue({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 100,
    });
    ctx.driver.refund.mockImplementation(async (request: { refundNo: string; amount: number }) => ({
      refundNo: request.refundNo,
      status: "SUCCESS",
      amount: request.amount,
    }));
    ctx.orderService.markLatePaymentRefunded.mockImplementation(async () => {
      order.status = OrderStatus.REFUNDED;
      return order;
    });

    await expect(ctx.service.confirmMock("2", "P1")).resolves.toMatchObject({
      status: PaymentStatus.REFUNDED,
    });
    expect(ctx.orderService.markRefunded).not.toHaveBeenCalled();
    expect(ctx.orderService.markLatePaymentRefunded).toHaveBeenCalledTimes(1);
    expect(ctx.orderService.publishRefunded).toHaveBeenCalledTimes(1);
  });
});
