import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as dayjs from "dayjs";
import * as customParseFormat from "dayjs/plugin/customParseFormat";
import { Repository } from "typeorm";

import { AppointmentConfigDto } from "./dto/appointment-config.dto";
import { AppointmentCreateDto } from "./dto/appointment-create.dto";
import { AppointmentQueryDto } from "./dto/appointment-query.dto";
import { AppointmentConfig } from "./entities/appointment-config.entity";
import { Appointment } from "./entities/appointment.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { Member } from "@/member/entities/member.entity";

dayjs.extend(customParseFormat);

const APPOINTMENT_CONFIG_ID = "1";
const APPOINTMENT_TIME_SLOTS = Array.from(
  { length: 9 },
  (_, index) => `${String(index + 10).padStart(2, "0")}:00`
);

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(AppointmentConfig)
    private readonly configRepository: Repository<AppointmentConfig>
  ) {}

  async create(memberId: string, dto: AppointmentCreateDto) {
    const appointmentAt = dayjs(
      `${dto.appointmentDate} ${dto.appointmentTime}`,
      "YYYY-MM-DD HH:mm",
      true
    );
    if (!appointmentAt.isValid()) {
      throw this.userError("预约日期或时间无效");
    }
    if (!APPOINTMENT_TIME_SLOTS.includes(dto.appointmentTime)) {
      throw this.userError("请选择有效预约时间段");
    }
    if (!appointmentAt.isAfter(dayjs())) {
      throw this.userError("预约时间不能早于当前时间");
    }

    try {
      return await this.appointmentRepository.manager.transaction(async (manager) => {
        const configRepository = manager.getRepository(AppointmentConfig);
        // ponytail: 全局配置行锁串行化创建；吞吐不足时改为按日期+时段号源行锁。
        const config = await this.ensureConfig(configRepository, true);
        const repository = manager.getRepository(Appointment);
        const appointmentTime = `${dto.appointmentTime}:00`;
        const exists = await repository.findOne({
          where: {
            memberId,
            appointmentDate: dto.appointmentDate,
            appointmentTime,
            isDeleted: 0,
          },
        });
        if (exists) throw this.duplicateError();

        const bookedCount = await repository.count({
          where: { appointmentDate: dto.appointmentDate, appointmentTime, isDeleted: 0 },
        });
        if (bookedCount >= config.slotCapacity) throw this.slotFullError();

        return repository.save(
          repository.create({
            memberId,
            appointmentDate: dto.appointmentDate,
            appointmentTime,
            isDeleted: 0,
          })
        );
      });
    } catch (error) {
      if (this.isDuplicateEntry(error)) throw this.duplicateError();
      throw error;
    }
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
        .andWhere("appointment.appointmentDate = :appointmentDate", { appointmentDate })
        .andWhere("appointment.appointmentTime IN (:...times)", {
          times: APPOINTMENT_TIME_SLOTS.map((time) => `${time}:00`),
        })
        .groupBy("appointment.appointmentTime")
        .getRawMany<{ time: string; bookedCount: string }>(),
    ]);
    const counts = new Map(
      rows.map((row) => [String(row.time).slice(0, 5), Number(row.bookedCount)])
    );

    return APPOINTMENT_TIME_SLOTS.map((time) => {
      const bookedCount = counts.get(time) ?? 0;
      const full = bookedCount >= slotCapacity;
      return {
        time,
        bookedCount,
        capacity: slotCapacity,
        remainingCount: Math.max(slotCapacity - bookedCount, 0),
        full,
        available:
          !full && dayjs(`${appointmentDate} ${time}`, "YYYY-MM-DD HH:mm", true).isAfter(dayjs()),
      };
    });
  }

  async pageQuery(query: AppointmentQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.appointmentRepository
      .createQueryBuilder("appointment")
      .innerJoin(Member, "member", "member.id = appointment.memberId AND member.isDeleted = 0")
      .where("appointment.isDeleted = 0");

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

    const total = await qb.getCount();
    const data = await qb
      .select([
        "appointment.id AS id",
        "appointment.memberId AS memberId",
        "member.nickname AS memberNickname",
        "member.mobile AS memberMobile",
        "DATE_FORMAT(appointment.appointmentDate, '%Y-%m-%d') AS appointmentDate",
        "TIME_FORMAT(appointment.appointmentTime, '%H:%i') AS appointmentTime",
        "appointment.createTime AS createTime",
      ])
      .orderBy("appointment.appointmentDate", "DESC")
      .addOrderBy("appointment.appointmentTime", "DESC")
      .addOrderBy("appointment.id", "DESC")
      .offset((pageNum - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    return { data, page: { pageNum, pageSize, total } };
  }

  async listByMonth(month: string) {
    const start = dayjs(month, "YYYY-MM", true);
    if (!start.isValid()) {
      throw this.userError("月份无效");
    }

    return this.appointmentRepository
      .createQueryBuilder("appointment")
      .innerJoin(Member, "member", "member.id = appointment.memberId AND member.isDeleted = 0")
      .where("appointment.isDeleted = 0")
      .andWhere("appointment.appointmentDate BETWEEN :startDate AND :endDate", {
        startDate: start.startOf("month").format("YYYY-MM-DD"),
        endDate: start.endOf("month").format("YYYY-MM-DD"),
      })
      .select([
        "appointment.id AS id",
        "appointment.memberId AS memberId",
        "member.nickname AS memberNickname",
        "member.mobile AS memberMobile",
        "DATE_FORMAT(appointment.appointmentDate, '%Y-%m-%d') AS appointmentDate",
        "TIME_FORMAT(appointment.appointmentTime, '%H:%i') AS appointmentTime",
        "appointment.createTime AS createTime",
      ])
      .orderBy("appointment.appointmentDate", "ASC")
      .addOrderBy("appointment.appointmentTime", "ASC")
      .addOrderBy("appointment.id", "ASC")
      .getRawMany();
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

  private slotFullError() {
    return this.userError("该时间段已约满，请选择其他时间");
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
