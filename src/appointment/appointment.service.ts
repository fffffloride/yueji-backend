import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as dayjs from "dayjs";
import * as customParseFormat from "dayjs/plugin/customParseFormat";
import { EntityManager, In, Not, Repository, SelectQueryBuilder } from "typeorm";

import {
  AppointmentOperationAction,
  AppointmentOperatorType,
  AppointmentStatus,
  AppointmentTab,
  type AppointmentOperationActionValue,
  type AppointmentOperatorTypeValue,
  type AppointmentTabValue,
} from "./appointment.constants";
import { AppointmentConfigDto } from "./dto/appointment-config.dto";
import { AppointmentCreateDto } from "./dto/appointment-create.dto";
import { AppointmentPageQueryDto } from "./dto/appointment-page-query.dto";
import { AppointmentQueryDto } from "./dto/appointment-query.dto";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { AppointmentOperationLog } from "./entities/appointment-operation-log.entity";
import { Appointment } from "./entities/appointment.entity";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { BusinessException } from "@/common/exceptions/business.exception";
import { Member } from "@/member/entities/member.entity";
import { BizOrderItem } from "@/order/entities/order-item.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { OrderStatus } from "@/order/order-status";

dayjs.extend(customParseFormat);

const APPOINTMENT_CONFIG_ID = "1";
const APPOINTMENT_TIME_SLOTS = Array.from(
  { length: 9 },
  (_, index) => `${String(index + 10).padStart(2, "0")}:00`
);
const ACTIVE_ORDER_APPOINTMENT_STATUSES = [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED];

type AppointmentPageFilters = Partial<AppointmentQueryDto> & {
  pageNum?: number;
  pageSize?: number;
};

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(AppointmentOperationLog)
    private readonly operationLogRepository: Repository<AppointmentOperationLog>,
    @InjectRepository(AppointmentConfig)
    private readonly configRepository: Repository<AppointmentConfig>,
    @InjectRepository(BizOrder)
    private readonly orderRepository: Repository<BizOrder>,
    @InjectRepository(BizOrderItem)
    private readonly orderItemRepository: Repository<BizOrderItem>
  ) {}

  async create(memberId: string, dto: AppointmentCreateDto) {
    this.assertFutureSlot(dto.appointmentDate, dto.appointmentTime);

    try {
      return await this.appointmentRepository.manager.transaction(async (manager) => {
        const config = await this.ensureConfig(manager.getRepository(AppointmentConfig), true);
        const repository = manager.getRepository(Appointment);
        const appointmentTime = this.dbTime(dto.appointmentTime);
        const exists = await repository.findOne({
          where: {
            memberId,
            appointmentDate: dto.appointmentDate,
            appointmentTime,
            status: AppointmentStatus.BOOKED,
            isDeleted: 0,
          },
        });
        if (exists) throw this.duplicateError();

        let sceneType: Appointment["sceneType"] = "CONSULTATION";
        let orderId: string | null = null;
        if (dto.orderId) {
          const order = await manager.getRepository(BizOrder).findOne({
            where: { id: dto.orderId, isDeleted: 0 },
            lock: { mode: "pessimistic_read" },
          });
          this.assertOrderEligible(order, memberId);
          const orderAppointment = await repository.findOne({
            where: {
              orderId: dto.orderId,
              status: In(ACTIVE_ORDER_APPOINTMENT_STATUSES),
              isDeleted: 0,
            },
          });
          if (orderAppointment) throw this.orderDuplicateError();
          sceneType = "ORDER";
          orderId = dto.orderId;
        }

        const bookedCount = await repository.count({
          where: {
            appointmentDate: dto.appointmentDate,
            appointmentTime,
            status: AppointmentStatus.BOOKED,
            isDeleted: 0,
          },
        });
        if (bookedCount >= config.slotCapacity) throw this.slotFullError();

        const appointment = await repository.save(
          repository.create({
            memberId,
            appointmentDate: dto.appointmentDate,
            appointmentTime,
            sceneType,
            orderId,
            status: AppointmentStatus.BOOKED,
            isDeleted: 0,
          })
        );
        await this.appendLog(
          manager,
          appointment,
          AppointmentOperationAction.CREATE,
          AppointmentOperatorType.MEMBER,
          memberId,
          null,
          { date: appointment.appointmentDate, time: appointment.appointmentTime }
        );
        return appointment;
      });
    } catch (error) {
      if (this.isDuplicateEntry(error)) {
        if (dto.orderId && this.isOrderDuplicateEntry(error)) throw this.orderDuplicateError();
        throw this.duplicateError();
      }
      throw error;
    }
  }

  async getOrderEligibility(memberId: string, orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId, isDeleted: 0 } });
    const reason = this.getOrderIneligibleReason(order, memberId);
    if (reason) return { eligible: false, reason };

    const exists = await this.appointmentRepository.findOne({
      where: { orderId, status: In(ACTIVE_ORDER_APPOINTMENT_STATUSES), isDeleted: 0 },
    });
    return exists ? { eligible: false, reason: "该订单已预约" } : { eligible: true, reason: "" };
  }

  async getConfig() {
    const config = await this.ensureConfig(this.configRepository);
    return { slotCapacity: config.slotCapacity };
  }

  async updateConfig(dto: AppointmentConfigDto) {
    if (!Number.isInteger(dto.slotCapacity) || dto.slotCapacity < 1) {
      throw this.userError("每时段预约上限必须是正整数");
    }
    const config = await this.ensureConfig(this.configRepository);
    config.slotCapacity = dto.slotCapacity;
    config.isDeleted = 0;
    await this.configRepository.save(config);
    return { slotCapacity: config.slotCapacity };
  }

  async listSlots(appointmentDate: string) {
    const date = dayjs(appointmentDate, "YYYY-MM-DD", true);
    if (!date.isValid()) throw this.userError("预约日期无效");

    const [{ slotCapacity }, rows] = await Promise.all([
      this.getConfig(),
      this.appointmentRepository
        .createQueryBuilder("appointment")
        .select("appointment.appointmentTime", "time")
        .addSelect("COUNT(*)", "bookedCount")
        .where("appointment.isDeleted = 0")
        .andWhere("appointment.status = :status", { status: AppointmentStatus.BOOKED })
        .andWhere("appointment.appointmentDate = :appointmentDate", { appointmentDate })
        .andWhere("appointment.appointmentTime IN (:...times)", {
          times: APPOINTMENT_TIME_SLOTS.map((time) => this.dbTime(time)),
        })
        .groupBy("appointment.appointmentTime")
        .getRawMany<{ time: string; bookedCount: string }>(),
    ]);
    const counts = new Map(
      rows.map((row) => [String(row.time).slice(0, 5), Number(row.bookedCount)])
    );

    return APPOINTMENT_TIME_SLOTS.map((time) => {
      const bookedCount = counts.get(time) ?? 0;
      const availableCapacity = Math.max(slotCapacity - bookedCount, 0);
      const full = availableCapacity === 0;
      return {
        time,
        bookedCount,
        capacity: slotCapacity,
        availableCapacity,
        remainingCount: availableCapacity,
        full,
        available:
          !full && dayjs(`${appointmentDate} ${time}`, "YYYY-MM-DD HH:mm", true).isAfter(dayjs()),
      };
    });
  }

  async getAppSummary(memberId: string) {
    const [pendingBooking, pendingArrival, serviceRecord] = await Promise.all([
      this.pendingOrderQuery(memberId).getCount(),
      this.appointmentRepository.count({
        where: { memberId, status: AppointmentStatus.BOOKED, isDeleted: 0 },
      }),
      this.appointmentRepository.count({
        where: { memberId, status: AppointmentStatus.COMPLETED, isDeleted: 0 },
      }),
    ]);
    return { pendingBooking, pendingArrival, serviceRecord };
  }

  async getAdminSummary() {
    const [pendingBooking, pendingArrival, serviceRecord, cancelled] = await Promise.all([
      this.pendingOrderQuery().getCount(),
      this.appointmentRepository.count({
        where: { status: AppointmentStatus.BOOKED, isDeleted: 0 },
      }),
      this.appointmentRepository.count({
        where: { status: AppointmentStatus.COMPLETED, isDeleted: 0 },
      }),
      this.appointmentRepository.count({
        where: { status: AppointmentStatus.CANCELLED, isDeleted: 0 },
      }),
    ]);
    return { pendingBooking, pendingArrival, serviceRecord, cancelled };
  }

  async appPageQuery(memberId: string, query: AppointmentPageQueryDto) {
    if (query.tab === AppointmentTab.PENDING_BOOKING) {
      return this.pagePendingOrders(query, memberId);
    }
    return this.pageAppointments(query, query.tab, memberId, true);
  }

  async pageQuery(query: AppointmentQueryDto) {
    const tab = query.tab ?? AppointmentTab.PENDING_ARRIVAL;
    if (tab === AppointmentTab.PENDING_BOOKING) return this.pagePendingOrders(query);
    return this.pageAppointments(query, tab, undefined, false);
  }

  async listByMonth(month: string) {
    const start = dayjs(month, "YYYY-MM", true);
    if (!start.isValid()) throw this.userError("月份无效");

    const rows = await this.selectAppointmentRows(this.appointmentQuery())
      .andWhere("appointment.appointmentDate BETWEEN :startDate AND :endDate", {
        startDate: start.startOf("month").format("YYYY-MM-DD"),
        endDate: start.endOf("month").format("YYYY-MM-DD"),
      })
      .orderBy("appointment.appointmentDate", "ASC")
      .addOrderBy("appointment.appointmentTime", "ASC")
      .addOrderBy("appointment.id", "ASC")
      .getRawMany();
    return this.toAppointmentRows(rows, false);
  }

  async getDetail(id: string) {
    const row = await this.selectAppointmentRows(this.appointmentQuery())
      .andWhere("appointment.id = :id", { id })
      .getRawOne();
    if (!row) throw this.userError("预约不存在");

    const [detail] = await this.toAppointmentRows([row], false);
    const operationLogs = await this.operationLogRepository.find({
      where: { appointmentId: id, isDeleted: 0 },
      order: { createTime: "ASC", id: "ASC" },
    });
    return {
      ...detail,
      operationLogs: operationLogs.map((log) => ({
        id: log.id,
        action: log.action,
        operatorType: log.operatorType,
        operatorId: log.operatorId ?? null,
        beforeDate: log.beforeDate ?? null,
        beforeTime: log.beforeTime ? String(log.beforeTime).slice(0, 5) : null,
        afterDate: log.afterDate ?? null,
        afterTime: log.afterTime ? String(log.afterTime).slice(0, 5) : null,
        reason: log.reason ?? null,
        createTime: log.createTime,
      })),
    };
  }

  async cancelByMember(memberId: string, id: string, reason?: string) {
    await this.cancel(id, reason, AppointmentOperatorType.MEMBER, memberId, memberId);
    return this.getDetail(id);
  }

  async cancelByAdmin(id: string, reason: string | undefined, operatorId: string) {
    await this.cancel(id, reason, AppointmentOperatorType.ADMIN, operatorId);
    return this.getDetail(id);
  }

  async rescheduleByMember(
    memberId: string,
    id: string,
    appointmentDate: string,
    appointmentTime: string,
    reason?: string
  ) {
    await this.reschedule(id, appointmentDate, appointmentTime, reason, memberId, memberId);
    return this.getDetail(id);
  }

  async rescheduleByAdmin(
    id: string,
    appointmentDate: string,
    appointmentTime: string,
    reason: string | undefined,
    operatorId: string
  ) {
    await this.reschedule(id, appointmentDate, appointmentTime, reason, undefined, operatorId);
    return this.getDetail(id);
  }

  async completeConsultation(id: string, operatorId: string) {
    await this.appointmentRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Appointment);
      const appointment = await repository.findOne({
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!appointment) throw this.userError("预约不存在");
      if (appointment.sceneType !== "CONSULTATION") {
        throw this.userError("订单预约请通过订单核销完成");
      }
      if (appointment.status === AppointmentStatus.COMPLETED) return;
      if (appointment.status !== AppointmentStatus.BOOKED) {
        throw this.userError("当前预约状态不可完成");
      }
      if (this.isFuture(appointment.appointmentDate, appointment.appointmentTime)) {
        throw this.userError("预约尚未开始，不能完成服务");
      }

      appointment.status = AppointmentStatus.COMPLETED;
      appointment.completeTime = new Date();
      appointment.updateBy = operatorId;
      await repository.save(appointment);
      await this.appendLog(
        manager,
        appointment,
        AppointmentOperationAction.COMPLETE,
        AppointmentOperatorType.ADMIN,
        operatorId,
        { date: appointment.appointmentDate, time: appointment.appointmentTime },
        { date: appointment.appointmentDate, time: appointment.appointmentTime }
      );
    });
    return this.getDetail(id);
  }

  async completeOrderAppointment(
    manager: EntityManager,
    orderId: string,
    operatorId: string
  ): Promise<void> {
    const repository = manager.getRepository(Appointment);
    const appointment = await repository.findOne({
      where: { orderId, status: AppointmentStatus.BOOKED, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!appointment) return;

    appointment.status = AppointmentStatus.COMPLETED;
    appointment.completeTime = new Date();
    appointment.updateBy = operatorId;
    await repository.save(appointment);
    await this.appendLog(
      manager,
      appointment,
      AppointmentOperationAction.COMPLETE,
      AppointmentOperatorType.ADMIN,
      operatorId,
      { date: appointment.appointmentDate, time: appointment.appointmentTime },
      { date: appointment.appointmentDate, time: appointment.appointmentTime },
      "订单核销"
    );
  }

  async cancelOrderAppointment(manager: EntityManager, orderId: string): Promise<void> {
    const repository = manager.getRepository(Appointment);
    const appointment = await repository.findOne({
      where: { orderId, status: AppointmentStatus.BOOKED, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!appointment) return;

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancelTime = new Date();
    appointment.cancelReason = "订单退款";
    await repository.save(appointment);
    await this.appendLog(
      manager,
      appointment,
      AppointmentOperationAction.CANCEL,
      AppointmentOperatorType.SYSTEM,
      null,
      { date: appointment.appointmentDate, time: appointment.appointmentTime },
      { date: appointment.appointmentDate, time: appointment.appointmentTime },
      "订单退款"
    );
  }

  async getOrderAppointmentMap(orderIds: string[]) {
    if (!orderIds.length) return new Map<string, { id: string; status: number }>();
    const rows = await this.appointmentRepository.find({
      where: {
        orderId: In(orderIds),
        status: In(ACTIVE_ORDER_APPOINTMENT_STATUSES),
        isDeleted: 0,
      },
      order: { id: "DESC" },
    });
    return new Map(
      rows.map((row) => [String(row.orderId), { id: String(row.id), status: row.status }])
    );
  }

  private async cancel(
    id: string,
    reason: string | undefined,
    operatorType: AppointmentOperatorTypeValue,
    operatorId: string | null,
    memberId?: string
  ) {
    await this.appointmentRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Appointment);
      const appointment = await repository.findOne({
        where: { id, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!appointment || (memberId && String(appointment.memberId) !== String(memberId))) {
        throw this.userError("预约不存在");
      }
      if (appointment.status === AppointmentStatus.CANCELLED) return;
      if (appointment.status !== AppointmentStatus.BOOKED) {
        throw this.userError("当前预约状态不可取消");
      }
      if (memberId && !this.isFuture(appointment.appointmentDate, appointment.appointmentTime)) {
        throw this.userError("预约已开始，请联系工作人员处理");
      }

      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancelTime = new Date();
      appointment.cancelReason = reason ?? null;
      if (operatorType === AppointmentOperatorType.ADMIN) appointment.updateBy = operatorId;
      await repository.save(appointment);
      await this.appendLog(
        manager,
        appointment,
        AppointmentOperationAction.CANCEL,
        operatorType,
        operatorId,
        { date: appointment.appointmentDate, time: appointment.appointmentTime },
        { date: appointment.appointmentDate, time: appointment.appointmentTime },
        reason
      );
    });
  }

  private async reschedule(
    id: string,
    appointmentDate: string,
    appointmentTime: string,
    reason: string | undefined,
    memberId: string | undefined,
    operatorId: string
  ) {
    this.assertFutureSlot(appointmentDate, appointmentTime);
    try {
      await this.appointmentRepository.manager.transaction(async (manager) => {
        const repository = manager.getRepository(Appointment);
        const appointment = await repository.findOne({
          where: { id, isDeleted: 0 },
          lock: { mode: "pessimistic_write" },
        });
        if (!appointment || (memberId && String(appointment.memberId) !== String(memberId))) {
          throw this.userError("预约不存在");
        }
        if (appointment.status !== AppointmentStatus.BOOKED) {
          throw this.userError("当前预约状态不可改期");
        }
        if (memberId && !this.isFuture(appointment.appointmentDate, appointment.appointmentTime)) {
          throw this.userError("预约已开始，请联系工作人员处理");
        }

        const targetTime = this.dbTime(appointmentTime);
        if (
          appointment.appointmentDate === appointmentDate &&
          String(appointment.appointmentTime).slice(0, 5) === appointmentTime
        ) {
          return;
        }

        const config = await this.ensureConfig(manager.getRepository(AppointmentConfig), true);
        const bookedCount = await repository.count({
          where: {
            id: Not(id),
            appointmentDate,
            appointmentTime: targetTime,
            status: AppointmentStatus.BOOKED,
            isDeleted: 0,
          },
        });
        if (bookedCount >= config.slotCapacity) throw this.slotFullError();

        const before = { date: appointment.appointmentDate, time: appointment.appointmentTime };
        appointment.appointmentDate = appointmentDate;
        appointment.appointmentTime = targetTime;
        if (!memberId) appointment.updateBy = operatorId;
        await repository.save(appointment);
        await this.appendLog(
          manager,
          appointment,
          AppointmentOperationAction.RESCHEDULE,
          memberId ? AppointmentOperatorType.MEMBER : AppointmentOperatorType.ADMIN,
          operatorId,
          before,
          { date: appointmentDate, time: targetTime },
          reason
        );
      });
    } catch (error) {
      if (this.isDuplicateEntry(error)) throw this.duplicateError();
      throw error;
    }
  }

  private async pagePendingOrders(query: AppointmentPageFilters, memberId?: string) {
    if (query.sceneType && query.sceneType !== "ORDER") return this.emptyPage(query);
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.pendingOrderQuery(memberId);
    if (query.keywords) {
      qb.andWhere("(member.nickname LIKE :keywords OR member.mobile LIKE :keywords)", {
        keywords: `%${query.keywords}%`,
      });
    }
    if (query.orderNo) qb.andWhere("o.orderNo LIKE :orderNo", { orderNo: `%${query.orderNo}%` });

    const total = await qb.getCount();
    const rows = await qb
      .select([
        "o.id AS orderId",
        "o.orderNo AS orderNo",
        "o.memberId AS memberId",
        "member.nickname AS memberNickname",
        "member.mobile AS memberMobile",
        "o.payTime AS payTime",
        "o.createTime AS createTime",
        "o.updateTime AS updateTime",
      ])
      .orderBy("o.payTime", "DESC")
      .addOrderBy("o.id", "DESC")
      .offset((pageNum - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();
    const enriched = await this.enrichOrderScenes(rows);
    return {
      data: enriched.map((row) => ({
        id: null,
        appointmentId: null,
        orderId: String(row.orderId),
        orderNo: row.orderNo,
        memberId: String(row.memberId),
        memberNickname: row.memberNickname ?? "",
        memberMobile: row.memberMobile ?? "",
        sceneType: "ORDER" as const,
        status: null,
        appointmentDate: null,
        appointmentTime: null,
        productNames: row.productNames,
        completeTime: null,
        cancelTime: null,
        cancelReason: null,
        createTime: row.createTime,
        updateTime: row.updateTime,
        lastChangedAt: row.payTime ?? row.updateTime ?? row.createTime,
        occupiesCapacity: false,
        canBook: true,
        canCancel: false,
        canReschedule: false,
        canComplete: false,
      })),
      page: { pageNum, pageSize, total },
    };
  }

  private async pageAppointments(
    query: AppointmentPageFilters,
    tab: AppointmentTabValue,
    memberId?: string,
    selfService = false
  ) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.appointmentQuery(memberId).andWhere("appointment.status = :status", {
      status: this.statusForTab(tab),
    });
    if (query.keywords) {
      qb.andWhere("(member.nickname LIKE :keywords OR member.mobile LIKE :keywords)", {
        keywords: `%${query.keywords}%`,
      });
    }
    if (query.appointmentDate) {
      qb.andWhere("appointment.appointmentDate = :appointmentDate", {
        appointmentDate: query.appointmentDate,
      });
    }
    if (query.startDate) {
      qb.andWhere("appointment.appointmentDate >= :startDate", { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere("appointment.appointmentDate <= :endDate", { endDate: query.endDate });
    }
    if (query.sceneType) {
      qb.andWhere("appointment.sceneType = :sceneType", { sceneType: query.sceneType });
    }
    if (query.orderNo)
      qb.andWhere("orders.orderNo LIKE :orderNo", { orderNo: `%${query.orderNo}%` });

    const total = await qb.getCount();
    const selected = this.selectAppointmentRows(qb);
    if (tab === AppointmentTab.PENDING_ARRIVAL) {
      selected
        .orderBy("appointment.appointmentDate", "ASC")
        .addOrderBy("appointment.appointmentTime", "ASC");
    } else {
      selected.orderBy("appointment.updateTime", "DESC");
    }
    const rows = await selected
      .addOrderBy("appointment.id", "DESC")
      .offset((pageNum - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();
    return {
      data: await this.toAppointmentRows(rows, selfService),
      page: { pageNum, pageSize, total },
    };
  }

  private pendingOrderQuery(memberId?: string) {
    const qb = this.orderRepository
      .createQueryBuilder("o")
      .innerJoin(Member, "member", "member.id = o.memberId AND member.isDeleted = 0")
      .where("o.isDeleted = 0")
      .andWhere("o.status = :paidStatus", { paidStatus: OrderStatus.PAID })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM appointment active_appointment
          WHERE active_appointment.order_id = o.id
            AND active_appointment.status IN (:...activeStatuses)
            AND active_appointment.is_deleted = 0
        )`,
        { activeStatuses: ACTIVE_ORDER_APPOINTMENT_STATUSES }
      );
    if (memberId) qb.andWhere("o.memberId = :memberId", { memberId });
    return qb;
  }

  private appointmentQuery(memberId?: string) {
    const qb = this.appointmentRepository
      .createQueryBuilder("appointment")
      .innerJoin(Member, "member", "member.id = appointment.memberId AND member.isDeleted = 0")
      .leftJoin(BizOrder, "orders", "orders.id = appointment.orderId AND orders.isDeleted = 0")
      .where("appointment.isDeleted = 0");
    if (memberId) qb.andWhere("appointment.memberId = :memberId", { memberId });
    return qb;
  }

  private selectAppointmentRows(qb: SelectQueryBuilder<Appointment>) {
    return qb.select([
      "appointment.id AS id",
      "appointment.memberId AS memberId",
      "member.nickname AS memberNickname",
      "member.mobile AS memberMobile",
      "DATE_FORMAT(appointment.appointmentDate, '%Y-%m-%d') AS appointmentDate",
      "TIME_FORMAT(appointment.appointmentTime, '%H:%i') AS appointmentTime",
      "appointment.sceneType AS sceneType",
      "appointment.orderId AS orderId",
      "appointment.status AS status",
      "appointment.completeTime AS completeTime",
      "appointment.cancelTime AS cancelTime",
      "appointment.cancelReason AS cancelReason",
      "appointment.createTime AS createTime",
      "appointment.updateTime AS updateTime",
    ]);
  }

  private async toAppointmentRows(rows: Record<string, any>[], selfService: boolean) {
    const enriched = await this.enrichOrderScenes(rows);
    return enriched.map((row) => {
      const status = Number(row.status);
      const future = this.isFuture(row.appointmentDate, row.appointmentTime);
      const booked = status === AppointmentStatus.BOOKED;
      return {
        ...row,
        id: String(row.id),
        appointmentId: String(row.id),
        memberId: String(row.memberId),
        orderId: row.orderId ? String(row.orderId) : null,
        status,
        appointmentTime: String(row.appointmentTime).slice(0, 5),
        completeTime: row.completeTime ?? null,
        cancelTime: row.cancelTime ?? null,
        cancelReason: row.cancelReason ?? null,
        lastChangedAt: row.updateTime ?? row.createTime,
        occupiesCapacity: booked,
        canBook: false,
        canCancel: booked && (!selfService || future),
        canReschedule: booked && (!selfService || future),
        canComplete: !selfService && booked && row.sceneType === "CONSULTATION" && !future,
      };
    });
  }

  private async enrichOrderScenes<T extends { orderId?: string | null }>(rows: T[]) {
    const orderIds = Array.from(
      new Set(rows.map((row) => row.orderId).filter((id): id is string => Boolean(id)))
    ).map(String);
    if (!orderIds.length) {
      return rows.map((row) => ({ ...row, orderNo: null, productNames: [] as string[] }));
    }

    const [orders, items] = await Promise.all([
      this.orderRepository.find({ where: { id: In(orderIds), isDeleted: 0 } }),
      this.orderItemRepository.find({
        where: { orderId: In(orderIds), isDeleted: 0 },
        order: { id: "ASC" },
      }),
    ]);
    const orderMap = new Map(orders.map((order) => [String(order.id), order.orderNo]));
    const productMap = new Map<string, string[]>();
    for (const item of items) {
      const id = String(item.orderId);
      productMap.set(id, [...(productMap.get(id) ?? []), item.productName]);
    }

    return rows.map((row) => {
      const orderId = row.orderId ? String(row.orderId) : "";
      return {
        ...row,
        orderNo: orderMap.get(orderId) ?? null,
        productNames: productMap.get(orderId) ?? [],
      };
    });
  }

  private async appendLog(
    manager: EntityManager,
    appointment: Appointment,
    action: AppointmentOperationActionValue,
    operatorType: AppointmentOperatorTypeValue,
    operatorId: string | null,
    before: { date: string; time: string } | null,
    after: { date: string; time: string } | null,
    reason?: string
  ) {
    const repository = manager.getRepository(AppointmentOperationLog);
    await repository.save(
      repository.create({
        appointmentId: appointment.id,
        action,
        operatorType,
        operatorId,
        beforeDate: before?.date ?? null,
        beforeTime: before?.time ?? null,
        afterDate: after?.date ?? null,
        afterTime: after?.time ?? null,
        reason: reason ?? null,
        isDeleted: 0,
      })
    );
  }

  private assertFutureSlot(appointmentDate: string, appointmentTime: string) {
    const appointmentAt = dayjs(`${appointmentDate} ${appointmentTime}`, "YYYY-MM-DD HH:mm", true);
    if (!appointmentAt.isValid()) throw this.userError("预约日期或时间无效");
    if (!APPOINTMENT_TIME_SLOTS.includes(appointmentTime)) {
      throw this.userError("请选择有效预约时间段");
    }
    if (!appointmentAt.isAfter(dayjs())) throw this.userError("预约时间不能早于当前时间");
  }

  private isFuture(appointmentDate: string, appointmentTime: string) {
    return dayjs(
      `${appointmentDate} ${String(appointmentTime).slice(0, 5)}`,
      "YYYY-MM-DD HH:mm",
      true
    ).isAfter(dayjs());
  }

  private statusForTab(tab: AppointmentTabValue) {
    if (tab === AppointmentTab.PENDING_ARRIVAL) return AppointmentStatus.BOOKED;
    if (tab === AppointmentTab.SERVICE_RECORD) return AppointmentStatus.COMPLETED;
    if (tab === AppointmentTab.CANCELLED) return AppointmentStatus.CANCELLED;
    throw this.userError("预约列表标签无效");
  }

  private emptyPage(query: AppointmentPageFilters) {
    return {
      data: [],
      page: { pageNum: query.pageNum ?? 1, pageSize: query.pageSize ?? 10, total: 0 },
    };
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }

  private duplicateError() {
    return new BusinessException({
      ...ErrorCode.DUPLICATE_SUBMISSION,
      msg: "该时间已预约，请勿重复提交",
    });
  }

  private orderDuplicateError() {
    return new BusinessException({
      ...ErrorCode.DUPLICATE_SUBMISSION,
      msg: "该订单已预约",
    });
  }

  private slotFullError() {
    return this.userError("该时间段已约满，请选择其他时间");
  }

  private assertOrderEligible(order: BizOrder | null, memberId: string): asserts order is BizOrder {
    const reason = this.getOrderIneligibleReason(order, memberId);
    if (reason) throw this.userError(reason);
  }

  private getOrderIneligibleReason(order: BizOrder | null, memberId: string): string {
    if (!order || String(order.memberId) !== String(memberId)) return "订单不可预约";
    if (order.status !== OrderStatus.PAID) return "当前订单状态不可预约";
    return "";
  }

  private dbTime(time: string) {
    return `${time.slice(0, 5)}:00`;
  }

  private async ensureConfig(
    repository: Repository<AppointmentConfig>,
    lock = false
  ): Promise<AppointmentConfig> {
    const options = {
      where: { id: APPOINTMENT_CONFIG_ID },
      ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
    };
    const existing = await repository.findOne(options);
    if (existing) return existing;

    try {
      return await repository.save(
        repository.create({ id: APPOINTMENT_CONFIG_ID, slotCapacity: 1, isDeleted: 0 })
      );
    } catch (error) {
      if (!this.isDuplicateEntry(error)) throw error;
      const created = await repository.findOne(options);
      if (created) return created;
      throw error;
    }
  }

  private isOrderDuplicateEntry(error: unknown) {
    const detail = error as { sqlMessage?: string; driverError?: { sqlMessage?: string } };
    return (detail.driverError?.sqlMessage ?? detail.sqlMessage ?? "").includes(
      "uk_appointment_active_order"
    );
  }

  private isDuplicateEntry(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const detail = error as { code?: string; errno?: number; driverError?: { code?: string } };
    return (
      detail.code === "ER_DUP_ENTRY" ||
      detail.errno === 1062 ||
      detail.driverError?.code === "ER_DUP_ENTRY"
    );
  }
}
