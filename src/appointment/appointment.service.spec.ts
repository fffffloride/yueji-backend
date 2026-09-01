import { AppointmentService } from "./appointment.service";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { BusinessException } from "@/common/exceptions/business.exception";

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
  const manager = {
    getRepository: jest.fn((entity) =>
      entity === AppointmentConfig ? configRepository : transactionAppointmentRepository
    ),
  };
  const appointmentRepository = {
    manager: { transaction: jest.fn(async (callback) => callback(manager)) },
    createQueryBuilder: jest.fn(),
  };
  const service = new AppointmentService(appointmentRepository as any, configRepository as any);

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
    });
    expect(configRepository.findOne).toHaveBeenCalledWith({
      where: { id: "1" },
      lock: { mode: "pessimistic_write" },
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
    const rows = [{ id: "1", appointmentDate: "2026-08-20", appointmentTime: "14:00" }];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    appointmentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.listByMonth("2026-08")).resolves.toEqual(rows);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "appointment.appointmentDate BETWEEN :startDate AND :endDate",
      { startDate: "2026-08-01", endDate: "2026-08-31" }
    );
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
