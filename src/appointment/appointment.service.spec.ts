import { AppointmentService } from "./appointment.service";
import { BusinessException } from "@/common/exceptions/business.exception";

describe("AppointmentService", () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const service = new AppointmentService(repository as any);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findOne.mockResolvedValue(null);
  });

  it("保存合法的未来预约", async () => {
    repository.save.mockImplementation(async (value) => ({ id: "1", ...value }));

    const result = await service.create("10", {
      appointmentDate: "2099-08-20",
      appointmentTime: "14:30",
    });

    expect(result).toMatchObject({
      id: "1",
      memberId: "10",
      appointmentDate: "2099-08-20",
      appointmentTime: "14:30:00",
    });
  });

  it("拒绝过去时间", async () => {
    const error = await service
      .create("10", { appointmentDate: "2000-01-01", appointmentTime: "09:00" })
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "预约时间不能早于当前时间",
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("将并发重复键转换为明确业务错误", async () => {
    repository.save.mockRejectedValue({ code: "ER_DUP_ENTRY" });

    const error = await service
      .create("10", { appointmentDate: "2099-08-20", appointmentTime: "14:30" })
      .catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "该时间已预约，请勿重复提交",
    });
  });

  it("按月返回预约列表", async () => {
    const rows = [{ id: "1", appointmentDate: "2026-08-20", appointmentTime: "14:30" }];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.listByMonth("2026-08")).resolves.toEqual(rows);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "appointment.appointmentDate BETWEEN :startDate AND :endDate",
      { startDate: "2026-08-01", endDate: "2026-08-31" }
    );
  });

  it("拒绝无效月份", async () => {
    const error = await service.listByMonth("2026-13").catch((reason) => reason as BusinessException);

    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).getResponse()).toMatchObject({
      msg: "月份无效",
    });
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
