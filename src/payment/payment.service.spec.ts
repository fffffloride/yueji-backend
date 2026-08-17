import { PaymentService } from "./payment.service";
import { PaymentStatus } from "./payment-status";

describe("PaymentService idempotency", () => {
  const existing = {
    id: "10",
    paymentNo: "P1",
    orderId: "1",
    memberId: "2",
    amount: 100,
    channel: "mock",
    status: PaymentStatus.SUCCESS,
    isDeleted: 0,
  };

  function setup() {
    const paymentRepository = { findOne: jest.fn() };
    const driver = {
      create: jest.fn(),
      query: jest.fn(),
      confirmCallback: jest.fn().mockResolvedValue({
        paymentNo: "P1",
        status: "SUCCESS",
      }),
      refund: jest.fn(),
    };
    const config = { get: jest.fn((_key: string, fallback: string) => fallback) };
    const manager = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn(),
      create: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((work: (value: typeof manager) => unknown) => work(manager)),
    };
    const orderService = {
      lockForPayment: jest.fn().mockResolvedValue({
        id: "1",
        memberId: "2",
        status: 0,
      }),
      markPaid: jest.fn(),
      publishPaid: jest.fn(),
    };
    const service = new PaymentService(
      paymentRepository as never,
      driver as never,
      config as never,
      dataSource as never,
      orderService as never
    );
    return { service, paymentRepository, driver, orderService };
  }

  it("同一订单重复创建复用已有支付单", async () => {
    const { service, driver } = setup();
    await expect(service.create("2", "1")).resolves.toMatchObject({ paymentNo: "P1" });
    expect(driver.create).not.toHaveBeenCalled();
  });

  it("已成功支付重复确认不再次推进订单", async () => {
    const { service, paymentRepository, orderService } = setup();
    paymentRepository.findOne.mockResolvedValue(existing);

    await expect(service.confirmMock("2", "P1")).resolves.toMatchObject({
      status: PaymentStatus.SUCCESS,
    });
    expect(orderService.markPaid).not.toHaveBeenCalled();
    expect(orderService.publishPaid).not.toHaveBeenCalled();
  });
});
