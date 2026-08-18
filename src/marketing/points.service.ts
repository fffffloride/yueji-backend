import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import {
  DEFAULT_POINTS_RULE,
  POINTS_RULE_KEY,
  PointsBizType,
  type PointsRule,
} from "./marketing.constants";
import { PointsLogQueryDto, PointsRuleDto } from "./dto/marketing.dto";
import { MemberPointsLog } from "./entities/member-points-log.entity";
import { Member } from "@/member/entities/member.entity";
import { SysConfig } from "@/system/config/entities/sys-config.entity";
import { ConfigService as SystemConfigService } from "@/system/config/config.service";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { resolveEffectiveMemberLevel } from "./member-level-resolver";

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(MemberPointsLog)
    private readonly logRepository: Repository<MemberPointsLog>,
    @InjectRepository(SysConfig)
    private readonly configRepository: Repository<SysConfig>,
    private readonly configService: SystemConfigService
  ) {}

  async getRule(): Promise<PointsRule> {
    const raw = await this.configService.getConfigValue(POINTS_RULE_KEY);
    if (!raw) return DEFAULT_POINTS_RULE;
    try {
      return { ...DEFAULT_POINTS_RULE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_POINTS_RULE;
    }
  }

  async updateRule(dto: PointsRuleDto) {
    let config = await this.configRepository.findOne({
      where: { configKey: POINTS_RULE_KEY, isDeleted: 0 },
    });
    if (!config) {
      config = this.configRepository.create({
        configName: "营销积分规则",
        configKey: POINTS_RULE_KEY,
        configValue: JSON.stringify(dto),
        remark: "每元赠送、每元抵扣积分、最高抵扣万分比",
        isDeleted: 0,
      });
    } else {
      config.configValue = JSON.stringify(dto);
    }
    await this.configRepository.save(config);
    await this.configService.refreshCache();
    return dto;
  }

  async page(query: PointsLogQueryDto, ownedMemberId?: string) {
    const qb = this.logRepository
      .createQueryBuilder("log")
      .leftJoin(Member, "member", "member.id = log.memberId")
      .addSelect(["member.nickname", "member.mobile"])
      .where("log.isDeleted = 0");
    if (ownedMemberId) qb.andWhere("log.memberId = :memberId", { memberId: ownedMemberId });
    else if (query.memberId) qb.andWhere("log.memberId = :memberId", { memberId: query.memberId });
    if (query.bizType) qb.andWhere("log.bizType = :bizType", { bizType: query.bizType });
    if (query.keywords) {
      qb.andWhere("(member.nickname LIKE :kw OR member.mobile LIKE :kw OR log.bizId LIKE :kw)", {
        kw: `%${query.keywords}%`,
      });
    }
    if (query.startTime && query.endTime) {
      qb.andWhere("log.createTime BETWEEN :startTime AND :endTime", {
        startTime: new Date(query.startTime),
        endTime: new Date(query.endTime),
      });
    } else if (query.startTime) {
      qb.andWhere("log.createTime >= :startTime", { startTime: new Date(query.startTime) });
    } else if (query.endTime) {
      qb.andWhere("log.createTime <= :endTime", { endTime: new Date(query.endTime) });
    }
    const [entities, total] = await qb
      .orderBy("log.createTime", "DESC")
      .skip((query.pageNum - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    const memberIds = [...new Set(entities.map((item) => item.memberId))];
    const members = memberIds.length
      ? await this.logRepository.manager.find(Member, { where: memberIds.map((id) => ({ id })) })
      : [];
    const memberMap = new Map(members.map((item) => [String(item.id), item]));
    return {
      data: entities.map((item) => ({
        ...item,
        memberNickname: memberMap.get(String(item.memberId))?.nickname ?? "",
        memberMobile: memberMap.get(String(item.memberId))?.mobile ?? "",
      })),
      page: { pageNum: query.pageNum, pageSize: query.pageSize, total },
    };
  }

  async account(memberId: string) {
    const member = await this.logRepository.manager.findOne(Member, {
      where: { id: memberId, isDeleted: 0 },
    });
    if (!member) throw this.userError("会员不存在");
    const level = await resolveEffectiveMemberLevel(this.logRepository.manager, member);
    return {
      points: member.points,
      totalSpent: member.totalSpent,
      level: level ? { id: level.id, name: level.name, discountRate: level.discountRate } : null,
      rule: await this.getRule(),
    };
  }

  async adjust(
    manager: EntityManager,
    memberId: string,
    changePoints: number,
    bizType: PointsBizType,
    bizId: string,
    orderId: string,
    remark: string
  ) {
    const existing = await manager.findOne(MemberPointsLog, {
      where: { memberId, bizType, bizId, isDeleted: 0 },
    });
    if (existing) return existing;
    const member = await manager.findOne(Member, {
      where: { id: memberId, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!member) throw this.userError("会员不存在");
    const balance = member.points + changePoints;
    if (balance < 0) throw this.userError("积分余额不足");
    member.points = balance;
    await manager.save(member);
    return manager.save(
      manager.create(MemberPointsLog, {
        memberId,
        changePoints,
        balanceAfter: balance,
        bizType,
        bizId,
        orderId,
        remark,
        isDeleted: 0,
      })
    );
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
