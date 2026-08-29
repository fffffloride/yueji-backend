import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Member } from "./entities/member.entity";
import { MemberQueryDto } from "./dto/member-query.dto";
import { MemberProfileDto, MemberProfileResponseDto } from "./dto/member-profile.dto";
import { MemberUpdateDto } from "./dto/member-update.dto";
import { buildMemberStats, PAID_MEMBER_ORDER_STATUSES } from "./member-stats";
import { BizOrder } from "@/order/entities/order.entity";
import { ORDER_STATUS_LABEL } from "@/order/order-status";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { MemberLevel } from "@/marketing/entities/member-level.entity";
import { resolveEffectiveMemberLevel } from "@/marketing/member-level-resolver";

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

  private async findByOpenidIncludingDeleted(openid: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { openid } });
  }

  async findByMobile(mobile: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { mobile, isDeleted: 0 } });
  }

  private async findByUnionidIncludingDeleted(unionid: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { unionid } });
  }

  private async findByMobileIncludingDeleted(mobile: string): Promise<Member | null> {
    return this.memberRepository.findOne({ where: { mobile } });
  }

  /**
   * 按 openid 查找会员，不存在则创建
   */
  async findOrCreateByOpenid(
    openid: string,
    unionid?: string | null,
    mobile?: string | null
  ): Promise<Member> {
    const existing = await this.findByOpenidIncludingDeleted(openid);
    if (existing) {
      this.ensureMemberNotDeleted(existing);
      await this.assertMobileAvailable(existing.id, mobile);
      await this.bindUnionid(existing, unionid);
      if (mobile) await this.attachMobile(existing.id, mobile);
      return existing;
    }

    if (unionid && (await this.findByUnionidIncludingDeleted(unionid))) {
      throw this.identityError("该微信身份已绑定其他会员，请联系客服");
    }
    await this.assertMobileAvailable(undefined, mobile);

    const defaultLevel = await this.levelRepository.findOne({
      where: { thresholdAmount: 0, status: 1, isDeleted: 0 },
    });
    const member = this.memberRepository.create({
      openid,
      unionid: unionid || null,
      mobile: mobile || null,
      nickname: "微信用户",
      status: 1,
      points: 0,
      totalSpent: 0,
      levelId: defaultLevel?.id ?? null,
      isDeleted: 0,
    });
    try {
      await this.memberRepository.save(member);
      this.logger.log(`创建新会员：memberId=${member.id}`);
      return member;
    } catch (error) {
      if (!this.isDuplicateEntry(error)) throw error;

      // 两个首次登录请求可能同时通过前置查询；唯一键冲突后回读胜出的记录。
      const concurrent = await this.findByOpenidIncludingDeleted(openid);
      if (concurrent) {
        this.ensureMemberNotDeleted(concurrent);
        await this.assertMobileAvailable(concurrent.id, mobile);
        await this.bindUnionid(concurrent, unionid);
        if (mobile) await this.attachMobile(concurrent.id, mobile);
        return concurrent;
      }
      throw this.identityError("该微信身份已绑定其他会员，请联系客服");
    }
  }

  /**
   * 为会员绑定手机号
   */
  async attachMobile(memberId: string, mobile: string): Promise<Member> {
    const member = await this.getById(memberId);
    const holder = await this.findByMobileIncludingDeleted(mobile);
    if (holder && holder.id !== member.id) {
      throw this.identityError("该手机号已绑定其他会员，请联系客服");
    }
    if (member.mobile === mobile) return member;

    member.mobile = mobile;
    try {
      await this.memberRepository.save(member);
      return member;
    } catch (error) {
      if (this.isDuplicateEntry(error)) {
        throw this.identityError("该手机号已绑定其他会员，请联系客服");
      }
      throw error;
    }
  }

  async touchLastLogin(memberId: string): Promise<void> {
    await this.memberRepository.update(memberId, { lastLoginTime: new Date() });
  }

  /**
   * C端：获取会员资料白名单响应
   */
  async getAppProfile(memberId: string): Promise<MemberProfileResponseDto> {
    return this.toAppProfile(await this.getById(memberId));
  }

  /**
   * C端：更新会员资料
   */
  async updateProfile(memberId: string, dto: MemberProfileDto): Promise<MemberProfileResponseDto> {
    const member = await this.getById(memberId);
    if (dto.nickname !== undefined) member.nickname = dto.nickname;
    if (dto.avatar !== undefined) member.avatar = dto.avatar;
    if (dto.gender !== undefined) member.gender = dto.gender;
    const saved = await this.memberRepository.save(member);
    return this.toAppProfile(saved);
  }

  /**
   * B端：会员分页查询
   */
  async pageQuery(query: MemberQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.memberRepository.createQueryBuilder("member").where("member.isDeleted = 0");

    const keywords = query.keywords?.trim();
    if (keywords) {
      if (/^\d{6,20}$/.test(keywords)) {
        qb.andWhere("member.mobile = :mobile", { mobile: keywords });
      } else {
        qb.andWhere("member.nickname LIKE :nickname", { nickname: `${keywords}%` });
      }
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
      resolveEffectiveMemberLevel(this.levelRepository.manager, profile),
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

  private async bindUnionid(member: Member, unionid?: string | null): Promise<void> {
    if (!unionid) return;
    if (member.unionid) {
      if (member.unionid !== unionid) {
        throw this.identityError("微信身份信息不一致，请联系客服");
      }
      return;
    }

    const holder = await this.findByUnionidIncludingDeleted(unionid);
    if (holder && holder.id !== member.id) {
      throw this.identityError("该微信身份已绑定其他会员，请联系客服");
    }

    member.unionid = unionid;
    try {
      await this.memberRepository.save(member);
    } catch (error) {
      if (this.isDuplicateEntry(error)) {
        throw this.identityError("该微信身份已绑定其他会员，请联系客服");
      }
      throw error;
    }
  }

  private async assertMobileAvailable(
    memberId: string | undefined,
    mobile?: string | null
  ): Promise<void> {
    if (!mobile) return;
    const holder = await this.findByMobileIncludingDeleted(mobile);
    if (holder && holder.id !== memberId) {
      throw this.identityError("该手机号已绑定其他会员，请联系客服");
    }
  }

  private ensureMemberNotDeleted(member: Member): void {
    if (member.isDeleted !== 0) {
      throw this.identityError("会员账号已注销，请联系客服恢复");
    }
  }

  private toAppProfile(member: Member): MemberProfileResponseDto {
    return {
      id: member.id,
      nickname: member.nickname,
      avatar: member.avatar ?? null,
      mobile: member.mobile ?? null,
      gender: member.gender,
      points: member.points,
      totalSpent: member.totalSpent,
      levelId: member.levelId ?? null,
    };
  }

  private identityError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.USER_LOGIN_EXCEPTION, msg });
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
