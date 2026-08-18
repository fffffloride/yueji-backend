import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as dayjs from "dayjs";
import * as customParseFormat from "dayjs/plugin/customParseFormat";
import { Repository } from "typeorm";

import { AppointmentCreateDto } from "./dto/appointment-create.dto";
import { AppointmentQueryDto } from "./dto/appointment-query.dto";
import { Appointment } from "./entities/appointment.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { Member } from "@/member/entities/member.entity";

dayjs.extend(customParseFormat);

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>
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
    if (!appointmentAt.isAfter(dayjs())) {
      throw this.userError("预约时间不能早于当前时间");
    }

    const exists = await this.appointmentRepository.findOne({
      where: {
        memberId,
        appointmentDate: dto.appointmentDate,
        appointmentTime: `${dto.appointmentTime}:00`,
        isDeleted: 0,
      },
    });
    if (exists) {
      throw this.duplicateError();
    }

    const appointment = this.appointmentRepository.create({
      memberId,
      appointmentDate: dto.appointmentDate,
      appointmentTime: `${dto.appointmentTime}:00`,
      isDeleted: 0,
    });
    try {
      return await this.appointmentRepository.save(appointment);
    } catch (error) {
      if (this.isDuplicateEntry(error)) throw this.duplicateError();
      throw error;
    }
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

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }

  private duplicateError() {
    return new BusinessException({
      ...ErrorCode.DUPLICATE_SUBMISSION,
      msg: "该时间已预约，请勿重复提交",
    });
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
