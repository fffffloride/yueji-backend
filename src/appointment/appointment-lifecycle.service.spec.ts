import { AppointmentService } from "./appointment.service";
import {
  AppointmentOperationAction,
  AppointmentOperatorType,
  AppointmentStatus,
} from "./appointment.constants";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { AppointmentOperationLog } from "./entities/appointment-operation-log.entity";
import { Appointment } from "./entities/appointment.entity";

describe("AppointmentService lifecycle", () => {
  const appointmentTxRepository = {
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(async (value) => value),
  };
  const configTxRepository = {
    findOne: jest.fn().mockResolvedValue({ id: "1", slotCapacity: 1, isDeleted: 0 }),
  };
  const logTxRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === Appointment) return appointmentTxRepository;
      if (entity === AppointmentConfig) return configTxRepository;
      if (entity === AppointmentOperationLog) return logTxRepository;
      throw new Error("unexpected repository");
    }),
  };
  const appointmentRepository = {
    manager: { transaction: jest.fn(async (callback) => callback(manager)) },
  };
  const service = new AppointmentService(
    appointmentRepository as any,
    { find: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    { findOne: jest.fn() } as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configTxRepository.findOne.mockResolvedValue({ id: "1", slotCapacity: 1, isDeleted: 0 });
    appointmentTxRepository.count.mockResolvedValue(0);
    appointmentTxRepository.save.mockImplementation(async (value) => value);
    logTxRepository.create.mockImplementation((value) => value);
    logTxRepository.save.mockImplementation(async (value) => value);
  });

  it("目标时段满额时保留原预约", async () => {
    const appointment: any = {
      id: "1",
      memberId: "10",
      appointmentDate: "2099-09-10",
      appointmentTime: "14:00:00",
      status: AppointmentStatus.BOOKED,
      isDeleted: 0,
    };
    appointmentTxRepository.findOne.mockResolvedValue(appointment);
    appointmentTxRepository.count.mockResolvedValue(1);

    await expect(
      (service as any).reschedule("1", "2099-09-11", "15:00", undefined, "10", "10")
    ).rejects.toMatchObject({ response: { msg: "该时间段已约满，请选择其他时间" } });

    expect(appointment).toMatchObject({
      appointmentDate: "2099-09-10",
      appointmentTime: "14:00:00",
    });
    expect(appointmentTxRepository.save).not.toHaveBeenCalled();
    expect(logTxRepository.save).not.toHaveBeenCalled();
  });

  it("会员不能取消已经开始的预约", async () => {
    appointmentTxRepository.findOne.mockResolvedValue({
      id: "1",
      memberId: "10",
      appointmentDate: "2020-01-01",
      appointmentTime: "10:00:00",
      status: AppointmentStatus.BOOKED,
      isDeleted: 0,
    });

    await expect(
      (service as any).cancel("1", undefined, AppointmentOperatorType.MEMBER, "10", "10")
    ).rejects.toMatchObject({ response: { msg: "预约已开始，请联系工作人员处理" } });
    expect(appointmentTxRepository.save).not.toHaveBeenCalled();
  });

  it("订单退款取消待到店预约且重复调用不重复写日志", async () => {
    const appointment: any = {
      id: "1",
      memberId: "10",
      orderId: "20",
      appointmentDate: "2099-09-10",
      appointmentTime: "14:00:00",
      status: AppointmentStatus.BOOKED,
      isDeleted: 0,
    };
    appointmentTxRepository.findOne.mockResolvedValueOnce(appointment).mockResolvedValueOnce(null);

    await service.cancelOrderAppointment(manager as any, "20");
    await service.cancelOrderAppointment(manager as any, "20");

    expect(appointment.status).toBe(AppointmentStatus.CANCELLED);
    expect(appointment.cancelReason).toBe("订单退款");
    expect(logTxRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "1",
        action: AppointmentOperationAction.CANCEL,
        operatorType: AppointmentOperatorType.SYSTEM,
      })
    );
    expect(logTxRepository.save).toHaveBeenCalledTimes(1);
  });

  it("订单核销完成待到店预约并记录核销管理员", async () => {
    const appointment = {
      id: "1",
      memberId: "10",
      orderId: "20",
      appointmentDate: "2026-09-01",
      appointmentTime: "14:00:00",
      status: AppointmentStatus.BOOKED,
      isDeleted: 0,
    };
    appointmentTxRepository.findOne.mockResolvedValue(appointment);

    await service.completeOrderAppointment(manager as any, "20", "99");

    expect(appointment.status).toBe(AppointmentStatus.COMPLETED);
    expect(logTxRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "1",
        action: AppointmentOperationAction.COMPLETE,
        operatorType: AppointmentOperatorType.ADMIN,
        operatorId: "99",
      })
    );
  });
});
