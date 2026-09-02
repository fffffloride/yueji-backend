import { OrderService } from "./order.service";
import { OrderStatus } from "./order-status";

describe("OrderService hardening", () => {
  const orderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const itemRepository = { find: jest.fn() };
  const memberRepository = { find: jest.fn(), findOne: jest.fn() };
  const manager = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const dataSource = {
    manager,
    transaction: jest.fn(),
  };
  const productService = {
    getSkuForQuote: jest.fn(),
    getSkuForOrder: jest.fn(),
    increaseSales: jest.fn(),
    adjustStock: jest.fn(),
  };
  const cartService = { findOwnedByIds: jest.fn() };
  const orderBenefits = {
    quote: jest.fn(),
    availableCoupons: jest.fn(),
    markPaid: jest.fn(),
    releaseOrder: jest.fn(),
    completeOrder: jest.fn(),
  };
  const appointmentService = {
    getOrderAppointmentMap: jest.fn().mockResolvedValue(new Map()),
    completeOrderAppointment: jest.fn(),
    cancelOrderAppointment: jest.fn(),
  };
  const service = new OrderService(
    orderRepository as never,
    itemRepository as never,
    memberRepository as never,
    dataSource as never,
    productService as never,
    cartService as never,
    orderBenefits as never,
    { emit: jest.fn() } as never,
    { get: jest.fn().mockReturnValue(30) } as never,
    appointmentService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("订单试算使用无锁商品读取且不开启数据库事务", async () => {
    productService.getSkuForQuote.mockResolvedValue({
      sku: { id: "10", productId: "20", price: 1000, stock: 8 },
      product: { id: "20", categoryId: "30", name: "商品" },
    });
    orderBenefits.quote.mockResolvedValue({ payAmount: 1000 });

    await service.quote("1", { items: [{ skuId: "10", quantity: 1 }] });

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(productService.getSkuForQuote).toHaveBeenCalledWith(manager, "10");
    expect(productService.getSkuForOrder).not.toHaveBeenCalled();
  });

  it("核销码唯一键冲突时重新生成并重试保存", async () => {
    const order = {
      id: "1",
      orderNo: "YJ1",
      memberId: "2",
      status: OrderStatus.UNPAID,
    } as any;
    manager.findOne.mockResolvedValue(null);
    manager.save
      .mockRejectedValueOnce({ driverError: { code: "ER_DUP_ENTRY" } })
      .mockResolvedValueOnce(order);
    manager.find.mockResolvedValue([]);

    await service.markPaid(manager as never, order, new Date(), 1);

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(order.verifyCode).toMatch(/^\d{8}$/);
    expect(orderBenefits.markPaid).toHaveBeenCalledWith(manager, order);
  });

  it("订单号使用更长随机空间并在唯一键冲突时重试", async () => {
    const order = {} as any;
    manager.save.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" }).mockResolvedValueOnce(order);

    await (service as any).saveNewOrder(manager, order);

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(order.orderNo).toMatch(/^YJ\d{14}[A-F0-9]{12}$/);
  });

  it("超时取消按固定批次查询且有最大批次数", async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValueOnce([
          { id: "1", createTime: new Date("2026-01-01T00:00:00Z") },
          { id: "2", createTime: new Date("2026-01-01T00:01:00Z") },
        ])
        .mockResolvedValueOnce([{ id: "3", createTime: new Date("2026-01-01T00:02:00Z") }]),
    };
    orderRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    const cancel = jest
      .spyOn(service as any, "cancelInternal")
      .mockResolvedValue({ status: OrderStatus.CANCELLED });

    await expect(service.cancelExpiredUnpaid(2, 2)).resolves.toBe(3);

    expect(queryBuilder.getMany).toHaveBeenCalledTimes(2);
    expect(queryBuilder.take).toHaveBeenCalledWith(2);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(o.createTime > :cursorTime OR (o.createTime = :cursorTime AND o.id > :cursorId))",
      expect.objectContaining({ cursorId: "2" })
    );
    expect(cancel).toHaveBeenCalledTimes(3);
  });

  it("导出超过 5000 条时拒绝在内存构造完整文件", async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(Array.from({ length: 5001 }, () => ({}))),
    };
    orderRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.listExport({})).rejects.toMatchObject({
      response: { msg: "单次最多导出5000条订单，请增加筛选条件后重试" },
    });
    expect(queryBuilder.take).toHaveBeenCalledWith(5001);
    expect(memberRepository.find).not.toHaveBeenCalled();
  });

  it("拒绝同时提交购物车和立即购买明细", async () => {
    await expect(
      service.quote("1", {
        cartIds: ["1"],
        items: [{ skuId: "10", quantity: 1 }],
      })
    ).rejects.toMatchObject({
      response: { msg: "购物车下单和立即购买不能同时提交" },
    });
  });

  it("退款订单时在同一事务管理器内取消关联预约", async () => {
    const order = { id: "20", status: OrderStatus.PAID } as any;
    manager.save.mockResolvedValue(order);
    manager.find.mockResolvedValue([]);

    await service.markRefunded(manager as never, order);

    expect(order.status).toBe(OrderStatus.REFUNDED);
    expect(appointmentService.cancelOrderAppointment).toHaveBeenCalledWith(manager, "20");
  });

  it("核销订单时在同一事务管理器内完成关联预约", async () => {
    const order = {
      id: "20",
      orderNo: "YJ20",
      memberId: "10",
      status: OrderStatus.PAID,
    } as any;
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));
    manager.findOne.mockResolvedValue(order);
    manager.save.mockResolvedValue(order);
    jest.spyOn(service, "getDetail").mockResolvedValue({ id: "20" } as any);

    await service.verifyById("20", "99");

    expect(appointmentService.completeOrderAppointment).toHaveBeenCalledWith(manager, "20", "99");
  });
});
