import { AppointmentService } from "./appointment.service";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { BizOrder } from "@/order/entities/order.entity";
import { OrderStatus } from "@/order/order-status";

describe("AppointmentService", () => {
  const transactionAppointmentRepository = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const configRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const operationLogRepository = { find: jest.fn() };
  const transactionOrderRepository = { findOne: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === AppointmentConfig) return configRepository;
      if (entity === BizOrder) return transactionOrderRepository;
      return transactionAppointmentRepository;
    }),
  };
  const appointmentRepository = {
    manager: { transaction: jest.fn(async (callback) => callback(manager)) },
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const orderRepository = { findOne: jest.fn(), find: jest.fn() };
  const orderItemRepository = { find: jest.fn() };
  const service = new AppointmentService(
    appointmentRepository as any,
    operationLogRepository as any,
    configRepository as any,
    orderRepository as any,
    orderItemRepository as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configRepository.findOne.mockResolvedValue({ id: "1", slotCapacity: 1, isDeleted: 0 });
    configRepository.save.mockImplementation(async (value) => value);
    transactionAppointmentRepository.findOne.mockResolvedValue(null);
    transactionAppointmentRepository.count.mockResolvedValue(0);
    transactionAppointmentRepository.save.mockImplementation(async (value) => ({
      id: "1",
      ...value,
    }));
    transactionOrderRepository.findOne.mockResolvedValue(null);
    appointmentRepository.findOne.mockResolvedValue(null);
    orderRepository.findOne.mockResolvedValue(null);
    orderRepository.find.mockResolvedValue([]);
    orderItemRepository.find.mockResolvedValue([]);
  });

  it("保存容量内的未来预约", async () => {
    const result = await service.create("10", {
      appointmentDate: "2099-08-20",
      appointmentTime: "14:00",
    });

    expect(result).toMatchObject({
      id: "1",
      memberId: "10",
      appointmentDate: "2099-08-20",
      appointmentTime: "14:00:00",
      sceneType: "CONSULTATION",
      orderId: null,
    });
    expect(configRepository.findOne).toHaveBeenCalledWith({
      where: { id: "1" },
      lock: { mode: "pessimistic_write" },
    });
  });

  it("保存当前会员的已支付订单预约", async () => {
    transactionOrderRepository.findOne.mockResolvedValue({
      id: "20",
      memberId: "10",
      status: OrderStatus.PAID,
    });

    await expect(
      service.create("10", {
        appointmentDate: "2099-08-20",
        appointmentTime: "15:00",
        orderId: "20",
      })
    ).resolves.toMatchObject({ sceneType: "ORDER", orderId: "20" });
  });

  it("拒绝非已支付订单预约", async () => {
    transactionOrderRepository.findOne.mockResolvedValue({ id: "20", memberId: "10", status: 0 });

    const error = await service
      .create("10", {
        appointmentDate: "2099-08-20",
        appointmentTime: "15:00",
        orderId: "20",
      })
      .catch((reason) => reason as BusinessException);

    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "当前订单状态不可预约",
    });
    expect(transactionAppointmentRepository.save).not.toHaveBeenCalled();
  });

  it("拒绝非本人和已预约订单", async () => {
    orderRepository.findOne.mockResolvedValue({
      id: "20",
      memberId: "11",
      status: OrderStatus.PAID,
    });
    await expect(service.getOrderEligibility("10", "20")).resolves.toEqual({
      eligible: false,
      reason: "订单不可预约",
    });

    orderRepository.findOne.mockResolvedValue({
      id: "20",
      memberId: "10",
      status: OrderStatus.PAID,
    });
    appointmentRepository.findOne.mockResolvedValue({ id: "30" });
    await expect(service.getOrderEligibility("10", "20")).resolves.toEqual({
      eligible: false,
      reason: "该订单已预约",
    });
  });

  it("拒绝过去时间", async () => {
    const error = await service
      .create("10", { appointmentDate: "2000-01-01", appointmentTime: "10:00" })
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "预约时间不能早于当前时间",
    });
    expect(appointmentRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it("拒绝非固定时间段", async () => {
    const error = await service
      .create("10", { appointmentDate: "2099-08-20", appointmentTime: "14:30" })
      .catch((reason) => reason as BusinessException);

    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "请选择有效预约时间段",
    });
    expect(appointmentRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it("拒绝已达默认容量的其他会员", async () => {
    transactionAppointmentRepository.count.mockResolvedValue(1);

    const error = await service
      .create("11", { appointmentDate: "2099-08-20", appointmentTime: "14:00" })
      .catch((reason) => reason as BusinessException);

    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "该时间段已约满，请选择其他时间",
    });
    expect(transactionAppointmentRepository.save).not.toHaveBeenCalled();
  });

  it("容量调高后允许写入至上限", async () => {
    configRepository.findOne.mockResolvedValue({ id: "1", slotCapacity: 2, isDeleted: 0 });
    transactionAppointmentRepository.count.mockResolvedValue(1);

    await expect(
      service.create("11", { appointmentDate: "2099-08-20", appointmentTime: "14:00" })
    ).resolves.toMatchObject({ memberId: "11" });
  });

  it("将并发重复键转换为明确业务错误", async () => {
    transactionAppointmentRepository.save.mockRejectedValue({ code: "ER_DUP_ENTRY" });

    const error = await service
      .create("10", { appointmentDate: "2099-08-20", appointmentTime: "14:00" })
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "该时间已预约，请勿重复提交",
    });
  });

  it("返回九个时间段及满额状态", async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ time: "10:00:00", bookedCount: "1" }]),
    };
    appointmentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const slots = await service.listSlots("2099-08-20");

    expect(slots).toHaveLength(9);
    expect(slots[0]).toMatchObject({
      time: "10:00",
      bookedCount: 1,
      capacity: 1,
      remainingCount: 0,
      full: true,
      available: false,
    });
    expect(slots[1]).toMatchObject({ time: "11:00", full: false, available: true });
    expect(slots[8]).toMatchObject({ time: "18:00" });
  });

  it("配置缺失时创建默认容量", async () => {
    configRepository.findOne.mockResolvedValue(null);
    configRepository.save.mockResolvedValue({ id: "1", slotCapacity: 1, isDeleted: 0 });

    await expect(service.getConfig()).resolves.toEqual({ slotCapacity: 1 });
    expect(configRepository.create).toHaveBeenCalledWith({
      id: "1",
      slotCapacity: 1,
      isDeleted: 0,
    });
  });

  it("拒绝无效容量", async () => {
    const error = await service
      .updateConfig({ slotCapacity: 0 })
      .catch((reason) => reason as BusinessException);

    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "每时段预约上限必须是正整数",
    });
    expect(configRepository.save).not.toHaveBeenCalled();
  });

  it("按月返回预约列表", async () => {
    const rows = [
      {
        id: "1",
        memberId: "10",
        status: 0,
        sceneType: "CONSULTATION",
        appointmentDate: "2026-08-20",
        appointmentTime: "14:00",
      },
    ];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    appointmentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.listByMonth("2026-08")).resolves.toEqual([
      expect.objectContaining({ ...rows[0], orderNo: null, productNames: [] }),
    ]);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "appointment.appointmentDate BETWEEN :startDate AND :endDate",
      { startDate: "2026-08-01", endDate: "2026-08-31" }
    );
  });

  it("为后台订单预约批量补充订单号和商品名称", async () => {
    const rows = [
      {
        id: "1",
        memberId: "10",
        status: 0,
        sceneType: "ORDER",
        orderId: "20",
        appointmentDate: "2026-08-20",
        appointmentTime: "14:00",
      },
    ];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    appointmentRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    orderRepository.find.mockResolvedValue([{ id: "20", orderNo: "YJ20" }]);
    orderItemRepository.find.mockResolvedValue([
      { id: "1", orderId: "20", productName: "水光项目" },
      { id: "2", orderId: "20", productName: "护理项目" },
    ]);

    await expect(service.listByMonth("2026-08")).resolves.toEqual([
      expect.objectContaining({
        ...rows[0],
        orderNo: "YJ20",
        productNames: ["水光项目", "护理项目"],
      }),
    ]);
  });

  it("拒绝无效月份", async () => {
    const error = await service
      .listByMonth("2026-13")
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "月份无效",
    });
    expect(appointmentRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
