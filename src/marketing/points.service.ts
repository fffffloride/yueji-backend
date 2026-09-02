import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import {
  DEFAULT_POINTS_RULE,
  POINTS_RULE_LIMITS,
  PointsBizType,
  type PointsRule,
} from "./marketing.constants";
import { PointsLogQueryDto, PointsRuleDto } from "./dto/marketing.dto";
import { MemberPointsLog } from "./entities/member-points-log.entity";
import { MarketingPointsRule } from "./entities/points-rule.entity";
import { MemberLevel } from "./entities/member-level.entity";
import { Member } from "@/member/entities/member.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { resolveEffectiveMemberLevel } from "./member-level-resolver";

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(MemberPointsLog)
    private readonly logRepository: Repository<MemberPointsLog>,
    @InjectRepository(MarketingPointsRule)
    private readonly ruleRepository: Repository<MarketingPointsRule>
  ) {}

  async getRule(): Promise<PointsRule> {
    const entity = await this.ruleRepository.findOne({ where: { id: "1", isDeleted: 0 } });
    if (!entity) return { ...DEFAULT_POINTS_RULE };
    const rule: PointsRule = {
      earnPerYuan: entity.earnPerYuan,
      redeemPointsPerYuan: entity.redeemPointsPerYuan,
      maxDeductRate: entity.maxDeductRate,
    };
    return this.isValidRule(rule) ? rule : { ...DEFAULT_POINTS_RULE };
  }

  async updateRule(dto: PointsRuleDto) {
    let entity = await this.ruleRepository.findOne({ where: { id: "1" } });
    if (!entity) entity = this.ruleRepository.create({ id: "1" });
    Object.assign(entity, dto, { isDeleted: 0 });
    await this.ruleRepository.save(entity);
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
    const levels = await this.logRepository.manager.find(MemberLevel, {
      where: { status: 1, isDeleted: 0 },
      order: { thresholdAmount: "ASC" },
    });
    const levelItems = levels.map((item, index) => ({
      id: item.id,
      name: item.name,
      code: `L${index + 1}`,
      thresholdAmount: item.thresholdAmount,
      discountRate: item.discountRate,
    }));
    const currentIndex = level ? levelItems.findIndex((item) => item.id === level.id) : -1;
    return {
      points: member.points,
      totalSpent: member.totalSpent,
      level: currentIndex >= 0 ? levelItems[currentIndex] : null,
      nextLevel:
        currentIndex >= 0
          ? (levelItems[currentIndex + 1] ?? null)
          : (levelItems.find((item) => item.thresholdAmount > member.totalSpent) ?? null),
      levels: levelItems,
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

  private isValidRule(rule: PointsRule): boolean {
    return (
      Number.isInteger(rule.earnPerYuan) &&
      rule.earnPerYuan >= 0 &&
      rule.earnPerYuan <= POINTS_RULE_LIMITS.maxEarnPerYuan &&
      Number.isInteger(rule.redeemPointsPerYuan) &&
      rule.redeemPointsPerYuan >= 1 &&
      rule.redeemPointsPerYuan <= POINTS_RULE_LIMITS.maxRedeemPointsPerYuan &&
      Number.isInteger(rule.maxDeductRate) &&
      rule.maxDeductRate >= 0 &&
      rule.maxDeductRate <= 10_000
    );
  }
}
