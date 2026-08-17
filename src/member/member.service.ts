import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Member } from "./entities/member.entity";
import { MemberQueryDto } from "./dto/member-query.dto";
import { MemberProfileDto } from "./dto/member-profile.dto";
import { MemberUpdateDto } from "./dto/member-update.dto";
import { buildMemberStats, PAID_MEMBER_ORDER_STATUSES } from "./member-stats";
import { BizOrder } from "@/order/entities/order.entity";
import { ORDER_STATUS_LABEL } from "@/order/order-status";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { MemberLevel } from "@/marketing/entities/member-level.entity";

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(BizOrder)
    private readonly orderRepository: Repository<BizOrder>,
    @InjectRepository(MemberLevel)
    private readonly levelRepository: Repository<MemberLevel>
  ) {}

  async findById(id: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { id, isDeleted: 0 } });
  }

  async getById(id: string): Promise<Member> {
    const member = await this.findById(id);
    if (!member) {
      throw new BusinessException({ ...ErrorCode.USER_ERROR, msg: "会员不存在" });
    }
    return member;
  }

  async findByOpenid(openid: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { openid, isDeleted: 0 } });
  }

  async findByMobile(mobile: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { mobile, isDeleted: 0 } });
  }

  /**
   * 按 openid 查找会员，不存在则创建
   */
  async findOrCreateByOpenid(openid: string, unionid?: string | null): Promise<Member> {
    const existing = await this.findByOpenid(openid);
    if (existing) {
      if (unionid && !existing.unionid) {
        existing.unionid = unionid;
        await this.memberRepository.save(existing);
      }
      return existing;
    }

    const defaultLevel = await this.levelRepository.findOne({
      where: { thresholdAmount: 0, status: 1, isDeleted: 0 },
    });
    const member = this.memberRepository.create({
      openid,
      unionid: unionid || null,
      nickname: "微信用户",
      status: 1,
      points: 0,
      totalSpent: 0,
      levelId: defaultLevel?.id ?? null,
      isDeleted: 0,
    });
    await this.memberRepository.save(member);
    this.logger.log(`创建新会员：memberId=${member.id}, openid=${openid}`);
    return member;
  }

  /**
   * 为会员绑定手机号
   */
  async attachMobile(memberId: string, mobile: string): Promise<Member> {
    const member = await this.getById(memberId);
    member.mobile = mobile;
    await this.memberRepository.save(member);
    return member;
  }

  async touchLastLogin(memberId: string): Promise<void> {
    await this.memberRepository.update(memberId, { lastLoginTime: new Date() });
  }

  /**
   * C端：更新会员资料
   */
  async updateProfile(memberId: string, dto: MemberProfileDto): Promise<Member> {
    const member = await this.getById(memberId);
    if (dto.nickname !== undefined) member.nickname = dto.nickname;
    if (dto.avatar !== undefined) member.avatar = dto.avatar;
    if (dto.gender !== undefined) member.gender = dto.gender;
    await this.memberRepository.save(member);
    return member;
  }

  /**
   * B端：会员分页查询
   */
  async pageQuery(query: MemberQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.memberRepository.createQueryBuilder("member").where("member.isDeleted = 0");

    if (query.keywords) {
      qb.andWhere("(member.nickname LIKE :kw OR member.mobile LIKE :kw)", {
        kw: `%${query.keywords}%`,
      });
    }
    if (query.status !== undefined) {
      qb.andWhere("member.status = :status", { status: query.status });
    }

    const [list, total] = await qb
      .orderBy("member.createTime", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: list,
      page: { pageNum, pageSize, total },
    };
  }

  async updateByAdmin(id: string, dto: MemberUpdateDto): Promise<Member> {
    const member = await this.getById(id);
    if (dto.tags !== undefined) member.tags = dto.tags || null;
    if (dto.remark !== undefined) member.remark = dto.remark || null;
    return this.memberRepository.save(member);
  }

  async get360(id: string) {
    const profile = await this.getById(id);
    const [aggregate, statusRows, recent, level] = await Promise.all([
      this.orderRepository
        .createQueryBuilder("o")
        .select("COUNT(*)", "orderCount")
        .addSelect(
          "COALESCE(SUM(CASE WHEN o.status IN (:...paidStatuses) THEN o.payAmount ELSE 0 END), 0)",
          "totalPaid"
        )
        .addSelect("SUM(CASE WHEN o.status IN (:...paidStatuses) THEN 1 ELSE 0 END)", "paidCount")
        .where("o.memberId = :id", { id })
        .andWhere("o.isDeleted = 0")
        .setParameter("paidStatuses", PAID_MEMBER_ORDER_STATUSES)
        .getRawOne<{ orderCount: string; totalPaid: string; paidCount: string }>(),
      this.orderRepository
        .createQueryBuilder("o")
        .select("o.status", "status")
        .addSelect("COUNT(*)", "count")
        .where("o.memberId = :id", { id })
        .andWhere("o.isDeleted = 0")
        .groupBy("o.status")
        .getRawMany<{ status: string; count: string }>(),
      this.orderRepository.find({
        where: { memberId: id, isDeleted: 0 },
        order: { createTime: "DESC" },
        take: 10,
      }),
      profile.levelId
        ? this.levelRepository.findOne({ where: { id: profile.levelId, isDeleted: 0 } })
        : Promise.resolve(null),
    ]);

    return {
      profile: { ...profile, levelName: level?.name ?? "普通会员" },
      stats: buildMemberStats(aggregate, statusRows),
      recentOrders: recent.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        statusLabel: ORDER_STATUS_LABEL[order.status] ?? String(order.status),
        payAmount: order.payAmount,
        createTime: order.createTime,
      })),
    };
  }
}
