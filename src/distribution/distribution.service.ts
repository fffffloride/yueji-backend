import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { DataSource, EntityManager, In, Not, Repository } from "typeorm";

import {
  AgentAccountStatusDto,
  AgentApplicationDto,
  AgentAuditDto,
  AgentFormDto,
  AgentLevelAdjustDto,
  AgentQueryDto,
  AgentRateAdjustDto,
  AgentTypeFormDto,
  CommissionQueryDto,
  DistributionConfigQueryDto,
  DistributionLevelFormDto,
} from "./dto/distribution.dto";
import {
  AgentStatus,
  CommissionStatus,
  ConfigStatus,
  DirectSalesStatus,
} from "./distribution.constants";
import { commissionAmount, effectiveRate, highestUpgradeLevel } from "./distribution.rules";
import { DistributionAgentType } from "./entities/agent-type.entity";
import { DistributionAgentLog } from "./entities/distribution-agent-log.entity";
import { DistributionAgent } from "./entities/distribution-agent.entity";
import { DistributionCommission } from "./entities/distribution-commission.entity";
import { DistributionDirectSale } from "./entities/distribution-direct-sale.entity";
import { DistributionLevel } from "./entities/distribution-level.entity";
import { DistributionReferral } from "./entities/distribution-referral.entity";
import { DomainEvents } from "@/common/events/domain-events";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { Member } from "@/member/entities/member.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { ORDER_EVENTS, OrderEventPayload } from "@/order/order.events";
import { OrderStatus } from "@/order/order-status";

@Injectable()
export class DistributionService implements OnModuleInit {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    @InjectRepository(DistributionAgentType)
    private readonly typeRepository: Repository<DistributionAgentType>,
    @InjectRepository(DistributionLevel)
    private readonly levelRepository: Repository<DistributionLevel>,
    @InjectRepository(DistributionAgent)
    private readonly agentRepository: Repository<DistributionAgent>,
    @InjectRepository(DistributionReferral)
    private readonly referralRepository: Repository<DistributionReferral>,
    @InjectRepository(DistributionCommission)
    private readonly commissionRepository: Repository<DistributionCommission>,
    @InjectRepository(DistributionDirectSale)
    private readonly directSalesRepository: Repository<DistributionDirectSale>,
    @InjectRepository(DistributionAgentLog)
    private readonly logRepository: Repository<DistributionAgentLog>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(BizOrder)
    private readonly orderRepository: Repository<BizOrder>,
    private readonly dataSource: DataSource,
    private readonly events: DomainEvents
  ) {}

  onModuleInit() {
    for (const event of [ORDER_EVENTS.PAID, ORDER_EVENTS.VERIFIED, ORDER_EVENTS.REFUNDED]) {
      this.events.on<OrderEventPayload>(event, ({ orderId }) => {
        void this.syncOrder(orderId).catch((error) =>
          this.logger.warn(`同步分销订单失败 orderId=${orderId}: ${String(error)}`)
        );
      });
    }
  }

  async typePage(query: DistributionConfigQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.typeRepository.createQueryBuilder("t").where("t.isDeleted = 0");
    if (query.status !== undefined) qb.andWhere("t.status = :status", { status: query.status });
    if (query.keywords) qb.andWhere("t.name LIKE :kw", { kw: `%${query.keywords}%` });
    const [data, total] = await qb
      .orderBy("t.sort", "ASC")
      .addOrderBy("t.id", "DESC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, page: { pageNum, pageSize, total } };
  }

  typeForm(id: string) {
    return this.findType(id);
  }

  async createType(dto: AgentTypeFormDto) {
    await this.ensureTypeName(dto.name);
    const sort =
      dto.sort ?? ((await this.typeRepository.maximum("sort", { isDeleted: 0 })) ?? 0) + 1;
    return this.typeRepository.save(this.typeRepository.create({ ...dto, sort, isDeleted: 0 }));
  }

  async updateType(id: string, dto: AgentTypeFormDto) {
    const row = await this.findType(id);
    await this.ensureTypeName(dto.name, id);
    const { sort, ...fields } = dto;
    Object.assign(row, fields);
    if (sort !== undefined) row.sort = sort;
    return this.typeRepository.save(row);
  }

  async updateTypeStatus(id: string, status: number) {
    const row = await this.findType(id);
    row.status = status;
    await this.typeRepository.save(row);
  }

  async removeType(id: string) {
    const row = await this.findType(id);
    if (await this.agentRepository.count({ where: { typeId: id, isDeleted: 0 } })) {
      throw this.userError("代理类型已被使用，不能删除");
    }
    row.isDeleted = 1;
    await this.typeRepository.save(row);
  }

  async levelPage(query: DistributionConfigQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.levelRepository.createQueryBuilder("l").where("l.isDeleted = 0");
    if (query.status !== undefined) qb.andWhere("l.status = :status", { status: query.status });
    if (query.keywords) qb.andWhere("l.name LIKE :kw", { kw: `%${query.keywords}%` });
    const [data, total] = await qb
      .orderBy("l.rank", "ASC")
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, page: { pageNum, pageSize, total } };
  }

  levelForm(id: string) {
    return this.findLevel(id);
  }

  async createLevel(dto: DistributionLevelFormDto) {
    this.validateLevel(dto);
    await this.ensureLevelUnique(dto.name, dto.rank);
    const deleted = await this.levelRepository.findOne({
      where: { rank: dto.rank, isDeleted: 1 },
    });
    return this.levelRepository.save(
      Object.assign(deleted ?? this.levelRepository.create(), dto, {
        sort: dto.rank,
        isDeleted: 0,
      })
    );
  }

  async updateLevel(id: string, dto: DistributionLevelFormDto) {
    this.validateLevel(dto);
    const row = await this.findLevel(id);
    await this.ensureLevelUnique(dto.name, dto.rank, id);
    if (dto.distributionDepth === 1) {
      const customSecond = await this.agentRepository.count({
        where: { levelId: id, customLevel2RateBps: Not(0), isDeleted: 0 },
      });
      if (customSecond) throw this.userError("该等级仍有代理配置二级专属比例");
    }
    Object.assign(row, dto);
    row.sort = dto.rank;
    return this.levelRepository.save(row);
  }

  async updateLevelStatus(id: string, status: number) {
    const row = await this.findLevel(id);
    row.status = status;
    await this.levelRepository.save(row);
  }

  async removeLevel(id: string) {
    const row = await this.findLevel(id);
    const [agents, commissions] = await Promise.all([
      this.agentRepository.count({ where: { levelId: id, isDeleted: 0 } }),
      this.commissionRepository.count({ where: { agentLevelId: id, isDeleted: 0 } }),
    ]);
    if (agents || commissions) throw this.userError("分销等级已被使用，不能删除");
    row.isDeleted = 1;
    await this.levelRepository.save(row);
  }

  async agentPage(query: AgentQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.agentRepository
      .createQueryBuilder("a")
      .leftJoin(Member, "m", "m.id = a.memberId AND m.isDeleted = 0")
      .leftJoin(DistributionAgentType, "t", "t.id = a.typeId AND t.isDeleted = 0")
      .leftJoin(DistributionLevel, "l", "l.id = a.levelId AND l.isDeleted = 0")
      .where("a.isDeleted = 0");
    if (query.status !== undefined) qb.andWhere("a.status = :status", { status: query.status });
    if (query.typeId) qb.andWhere("a.typeId = :typeId", { typeId: query.typeId });
    if (query.levelId) qb.andWhere("a.levelId = :levelId", { levelId: query.levelId });
    if (query.keywords) {
      qb.andWhere(
        "(a.realName LIKE :kw OR a.mobile LIKE :kw OR a.inviteCode LIKE :kw OR m.nickname LIKE :kw)",
        {
          kw: `%${query.keywords}%`,
        }
      );
    }
    const total = await qb.getCount();
    const data = await qb
      .select([
        "a.id AS id",
        "a.memberId AS memberId",
        "m.nickname AS memberNickname",
        "a.realName AS realName",
        "a.mobile AS mobile",
        "a.wechat AS wechat",
        "a.typeId AS typeId",
        "t.name AS typeName",
        "a.levelId AS levelId",
        "l.name AS levelName",
        "a.parentAgentId AS parentAgentId",
        "a.inviteCode AS inviteCode",
        "a.directVerifiedSales AS directVerifiedSales",
        "a.status AS status",
        "a.applyTime AS applyTime",
        "a.auditTime AS auditTime",
      ])
      .orderBy("a.id", "DESC")
      .offset((pageNum - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();
    return { data, page: { pageNum, pageSize, total } };
  }

  async agentDetail(id: string) {
    const agent = await this.findAgent(id);
    const [member, type, level, parent, summary] = await Promise.all([
      this.memberRepository.findOne({ where: { id: agent.memberId, isDeleted: 0 } }),
      agent.typeId
        ? this.typeRepository.findOne({ where: { id: agent.typeId, isDeleted: 0 } })
        : null,
      agent.levelId
        ? this.levelRepository.findOne({ where: { id: agent.levelId, isDeleted: 0 } })
        : null,
      agent.parentAgentId
        ? this.agentRepository.findOne({ where: { id: agent.parentAgentId, isDeleted: 0 } })
        : null,
      this.commissionSummary(agent.id),
    ]);
    return {
      ...agent,
      memberNickname: member?.nickname ?? null,
      typeName: type?.name ?? null,
      levelName: level?.name ?? null,
      parentName: parent?.realName ?? null,
      commissionSummary: summary,
    };
  }

  async createAgent(dto: AgentFormDto, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.validateAgentForm(manager, dto);
      if (
        await manager.findOne(DistributionAgent, {
          where: { memberId: dto.memberId, isDeleted: 0 },
        })
      ) {
        throw this.userError("该会员已是代理商");
      }
      const agent = manager.create(DistributionAgent, {
        ...dto,
        parentAgentId: dto.parentAgentId || null,
        inviteCode: await this.nextInviteCode(manager),
        directVerifiedSales: 0,
        status: AgentStatus.APPROVED,
        auditTime: new Date(),
        auditBy: operatorId,
        auditRemark: "后台新增",
        isDeleted: 0,
      });
      await manager.save(agent);
      if (agent.parentAgentId)
        await this.validateParent(manager, agent.id, agent.memberId, agent.parentAgentId);
      await this.writeLog(
        manager,
        agent.id,
        "CREATE",
        null,
        this.agentSnapshot(agent),
        "后台新增",
        operatorId
      );
      return agent;
    });
  }

  async updateAgent(id: string, dto: AgentFormDto, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await this.lockAgent(manager, id);
      if (String(agent.memberId) !== String(dto.memberId))
        throw this.userError("代理关联会员不能修改");
      await this.validateAgentForm(manager, dto);
      if (dto.parentAgentId)
        await this.validateParent(manager, id, agent.memberId, dto.parentAgentId);
      const before = this.agentSnapshot(agent);
      Object.assign(agent, dto, { parentAgentId: dto.parentAgentId || null });
      await manager.save(agent);
      await this.writeLog(
        manager,
        id,
        "UPDATE",
        before,
        this.agentSnapshot(agent),
        "维护代理信息",
        operatorId
      );
      return agent;
    });
  }

  async apply(memberId: string, dto: AgentApplicationDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.findMember(memberId, manager);
      await this.findType(dto.typeId, true, manager);
      const existing = await manager.findOne(DistributionAgent, {
        where: { memberId, isDeleted: 0 },
      });
      if (existing && existing.status !== AgentStatus.REJECTED)
        throw this.userError("已有有效代理申请");
      const now = new Date();
      const agent =
        existing ??
        manager.create(DistributionAgent, {
          memberId,
          inviteCode: await this.nextInviteCode(manager),
          directVerifiedSales: 0,
          isDeleted: 0,
        });
      Object.assign(agent, dto, {
        mobile: dto.mobile || null,
        wechat: dto.wechat || null,
        contactRemark: dto.contactRemark || null,
        typeId: dto.typeId,
        levelId: null,
        status: AgentStatus.PENDING,
        applyTime: now,
        auditTime: null,
        auditBy: null,
        auditRemark: null,
      });
      await manager.save(agent);
      await this.writeLog(
        manager,
        agent.id,
        existing ? "REAPPLY" : "APPLY",
        null,
        this.agentSnapshot(agent),
        "会员提交申请",
        null
      );
      return agent;
    });
  }

  async auditAgent(id: string, dto: AgentAuditDto, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await this.lockAgent(manager, id);
      if (agent.status !== AgentStatus.PENDING && agent.status !== AgentStatus.REJECTED)
        throw this.userError("当前代理状态不可审核");
      const before = this.agentSnapshot(agent);
      if (dto.status === AgentStatus.APPROVED) {
        const typeId = dto.typeId ?? agent.typeId;
        if (!typeId || !dto.levelId) throw this.userError("审核通过必须选择代理类型和分销等级");
        await this.findType(typeId, true, manager);
        await this.findLevel(dto.levelId, true, manager);
        const referral = await manager.findOne(DistributionReferral, {
          where: { memberId: agent.memberId, isDeleted: 0 },
        });
        const parentAgentId = dto.parentAgentId ?? referral?.referrerAgentId ?? null;
        if (parentAgentId) await this.validateParent(manager, id, agent.memberId, parentAgentId);
        agent.typeId = typeId;
        agent.levelId = dto.levelId;
        agent.parentAgentId = parentAgentId;
      }
      agent.status = dto.status;
      agent.auditTime = new Date();
      agent.auditBy = operatorId;
      agent.auditRemark = dto.reason;
      await manager.save(agent);
      await this.writeLog(
        manager,
        id,
        dto.status === AgentStatus.APPROVED ? "APPROVE" : "REJECT",
        before,
        this.agentSnapshot(agent),
        dto.reason,
        operatorId
      );
      return agent;
    });
  }

  async updateAgentStatus(id: string, dto: AgentAccountStatusDto, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await this.lockAgent(manager, id);
      if (agent.status !== AgentStatus.APPROVED && agent.status !== AgentStatus.DISABLED)
        throw this.userError("当前代理状态不可启停");
      const before = this.agentSnapshot(agent);
      agent.status = dto.status;
      await manager.save(agent);
      await this.writeLog(
        manager,
        id,
        dto.status === AgentStatus.DISABLED ? "DISABLE" : "ENABLE",
        before,
        this.agentSnapshot(agent),
        dto.reason,
        operatorId
      );
      return agent;
    });
  }

  async adjustAgentLevel(id: string, dto: AgentLevelAdjustDto, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await this.lockAgent(manager, id);
      await this.findLevel(dto.levelId, true, manager);
      const before = this.agentSnapshot(agent);
      agent.levelId = dto.levelId;
      await manager.save(agent);
      await this.writeLog(
        manager,
        id,
        "LEVEL",
        before,
        this.agentSnapshot(agent),
        dto.reason,
        operatorId
      );
      return agent;
    });
  }

  async adjustAgentRates(id: string, dto: AgentRateAdjustDto, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await this.lockAgent(manager, id);
      const level = agent.levelId ? await this.findLevel(agent.levelId, false, manager) : null;
      if ((dto.customLevel2RateBps ?? 0) > 0 && level?.distributionDepth !== 2) {
        throw this.userError("当前等级不允许二级佣金");
      }
      const before = this.agentSnapshot(agent);
      agent.customLevel1RateBps = dto.customLevel1RateBps ?? null;
      agent.customLevel2RateBps = dto.customLevel2RateBps ?? null;
      await manager.save(agent);
      await this.writeLog(
        manager,
        id,
        "RATE",
        before,
        this.agentSnapshot(agent),
        dto.reason,
        operatorId
      );
      return agent;
    });
  }

  async bindReferral(memberId: string, inviteCode: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.findMember(memberId, manager);
      if (await manager.findOne(DistributionReferral, { where: { memberId, isDeleted: 0 } })) {
        throw this.userError("推荐关系已绑定");
      }
      const referrer = await manager.findOne(DistributionAgent, {
        where: { inviteCode: inviteCode.trim(), status: AgentStatus.APPROVED, isDeleted: 0 },
      });
      if (!referrer) throw this.userError("邀请码无效或代理已停用");
      if (String(referrer.memberId) === String(memberId)) throw this.userError("不能绑定自己");
      const ownAgent = await manager.findOne(DistributionAgent, {
        where: { memberId, isDeleted: 0 },
      });
      if (ownAgent) {
        if (ownAgent.parentAgentId && String(ownAgent.parentAgentId) !== String(referrer.id)) {
          throw this.userError("代理已有上级");
        }
        await this.validateParent(manager, ownAgent.id, ownAgent.memberId, referrer.id);
        if (!ownAgent.parentAgentId) {
          ownAgent.parentAgentId = referrer.id;
          await manager.save(ownAgent);
        }
      }
      return manager.save(
        manager.create(DistributionReferral, {
          memberId,
          referrerAgentId: referrer.id,
          boundTime: new Date(),
          isDeleted: 0,
        })
      );
    });
  }

  async appProfile(memberId: string) {
    const agent = await this.agentRepository.findOne({ where: { memberId, isDeleted: 0 } });
    if (!agent)
      return {
        agent: null,
        commissionSummary: { waitingVerify: 0, pendingSettlement: 0, settled: 0, reversed: 0 },
      };
    const [type, level, summary] = await Promise.all([
      agent.typeId
        ? this.typeRepository.findOne({ where: { id: agent.typeId, isDeleted: 0 } })
        : null,
      agent.levelId
        ? this.levelRepository.findOne({ where: { id: agent.levelId, isDeleted: 0 } })
        : null,
      this.commissionSummary(agent.id),
    ]);
    return {
      agent: {
        ...agent,
        typeName: type?.name ?? null,
        levelName: level?.name ?? null,
        effectiveLevel1RateBps: level
          ? effectiveRate(agent.customLevel1RateBps, level.level1RateBps)
          : 0,
        effectiveLevel2RateBps: level
          ? effectiveRate(agent.customLevel2RateBps, level.level2RateBps)
          : 0,
      },
      commissionSummary: summary,
    };
  }

  async appCommissionPage(memberId: string, query: CommissionQueryDto) {
    const agent = await this.agentRepository.findOne({ where: { memberId, isDeleted: 0 } });
    if (!agent) throw this.userError("当前会员不是代理商");
    return this.commissionPage({ ...query, agentId: agent.id });
  }

  async appTeam(memberId: string) {
    const agent = await this.agentRepository.findOne({
      where: { memberId, status: AgentStatus.APPROVED, isDeleted: 0 },
    });
    if (!agent) throw this.userError("代理身份未启用");
    const rows = await this.agentRepository.find({
      where: { parentAgentId: agent.id, isDeleted: 0 },
      order: { id: "DESC" },
    });
    return {
      agentId: agent.id,
      directCount: rows.length,
      directVerifiedSales: agent.directVerifiedSales,
      agents: rows.map((row) => ({
        id: row.id,
        realName: row.realName,
        levelId: row.levelId,
        status: row.status,
        directVerifiedSales: row.directVerifiedSales,
      })),
    };
  }

  async teamTree(rootAgentId?: string) {
    const rows = await this.agentRepository.find({ where: { isDeleted: 0 }, order: { id: "ASC" } });
    const memberIds = [...new Set(rows.map((row) => row.memberId))];
    const members = memberIds.length
      ? await this.memberRepository.find({ where: { id: In(memberIds), isDeleted: 0 } })
      : [];
    const nicknames = new Map(members.map((member) => [String(member.id), member.nickname]));
    const children = new Map<string, DistributionAgent[]>();
    for (const row of rows) {
      const key = row.parentAgentId ? String(row.parentAgentId) : "root";
      children.set(key, [...(children.get(key) ?? []), row]);
    }
    const build = (row: DistributionAgent): Record<string, unknown> => ({
      id: row.id,
      realName: row.realName,
      memberNickname: nicknames.get(String(row.memberId)) ?? null,
      levelId: row.levelId,
      status: row.status,
      directVerifiedSales: row.directVerifiedSales,
      children: (children.get(String(row.id)) ?? []).map(build),
    });
    if (rootAgentId) return build(await this.findAgent(rootAgentId));
    return (children.get("root") ?? []).map(build);
  }

  async commissionPage(query: CommissionQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.commissionRepository
      .createQueryBuilder("c")
      .leftJoin(DistributionAgent, "a", "a.id = c.beneficiaryAgentId")
      .leftJoin(Member, "m", "m.id = c.buyerMemberId")
      .where("c.isDeleted = 0");
    if (query.agentId) qb.andWhere("c.beneficiaryAgentId = :agentId", { agentId: query.agentId });
    if (query.depth !== undefined) qb.andWhere("c.depth = :depth", { depth: query.depth });
    if (query.status !== undefined) qb.andWhere("c.status = :status", { status: query.status });
    if (query.startTime)
      qb.andWhere("c.paidTime >= :startTime", { startTime: new Date(query.startTime) });
    if (query.endTime) qb.andWhere("c.paidTime <= :endTime", { endTime: new Date(query.endTime) });
    if (query.keywords)
      qb.andWhere("(c.orderNo LIKE :kw OR a.realName LIKE :kw OR m.nickname LIKE :kw)", {
        kw: `%${query.keywords}%`,
      });
    const total = await qb.getCount();
    const data = await qb
      .select([
        "c.id AS id",
        "c.orderId AS orderId",
        "c.orderNo AS orderNo",
        "c.buyerMemberId AS buyerMemberId",
        "m.nickname AS buyerNickname",
        "c.beneficiaryAgentId AS beneficiaryAgentId",
        "a.realName AS beneficiaryName",
        "c.depth AS depth",
        "c.baseAmount AS baseAmount",
        "c.rateBps AS rateBps",
        "c.commissionAmount AS commissionAmount",
        "c.agentLevelName AS agentLevelName",
        "c.status AS status",
        "c.paidTime AS paidTime",
        "c.pendingSettlementTime AS pendingSettlementTime",
        "c.settledTime AS settledTime",
        "c.reversedTime AS reversedTime",
      ])
      .orderBy("c.id", "DESC")
      .offset((pageNum - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();
    return { data, page: { pageNum, pageSize, total } };
  }

  async agentLogs(agentId: string, pageNum = 1, pageSize = 10) {
    await this.findAgent(agentId);
    const [data, total] = await this.logRepository.findAndCount({
      where: { agentId, isDeleted: 0 },
      order: { id: "DESC" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    });
    return { data, page: { pageNum, pageSize, total } };
  }

  async syncOrder(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(BizOrder, {
        where: { id: orderId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!order) return;
      if (
        order.status === OrderStatus.PAID ||
        order.status === OrderStatus.VERIFIED ||
        order.status === OrderStatus.COMPLETED
      ) {
        await this.ensurePaidSnapshot(manager, order);
      }
      if (order.status === OrderStatus.VERIFIED || order.status === OrderStatus.COMPLETED) {
        await this.applyVerified(manager, order);
      }
      if (order.status === OrderStatus.REFUNDED) await this.reverseOrder(manager, order);
    });
  }

  async reconciliationOrderIds(limit = 500): Promise<string[]> {
    // ponytail: 仅重扫最近订单；日订单超过批量上限时改为持久化游标。
    const rows = await this.orderRepository.find({
      select: { id: true },
      where: {
        status: In([OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.REFUNDED]),
        isDeleted: 0,
      },
      order: { updateTime: "DESC" },
      take: limit,
    });
    return rows.map((row) => String(row.id));
  }

  private async ensurePaidSnapshot(manager: EntityManager, order: BizOrder) {
    if (
      await manager.findOne(DistributionDirectSale, { where: { orderId: order.id, isDeleted: 0 } })
    )
      return;
    const referral = await manager.findOne(DistributionReferral, {
      where: { memberId: order.memberId, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!referral) return;
    const direct = await manager.findOne(DistributionAgent, {
      where: { id: referral.referrerAgentId, status: AgentStatus.APPROVED, isDeleted: 0 },
    });
    if (!direct) return;
    const paidTime = order.payTime ?? new Date();
    await manager.save(
      manager.create(DistributionDirectSale, {
        orderId: order.id,
        buyerMemberId: order.memberId,
        agentId: direct.id,
        referralId: referral.id,
        amount: order.payAmount,
        status: DirectSalesStatus.PENDING,
        paidTime,
        isDeleted: 0,
      })
    );
    const snapshots: DistributionCommission[] = [];
    const directLevel = direct.levelId
      ? await manager.findOne(DistributionLevel, { where: { id: direct.levelId, isDeleted: 0 } })
      : null;
    if (directLevel) {
      const rate = effectiveRate(direct.customLevel1RateBps, directLevel.level1RateBps);
      const amount = commissionAmount(order.payAmount, rate);
      if (amount > 0)
        snapshots.push(
          this.commissionSnapshot(
            manager,
            order,
            direct,
            direct,
            directLevel,
            1,
            rate,
            amount,
            paidTime
          )
        );
    }
    if (direct.parentAgentId) {
      const parent = await manager.findOne(DistributionAgent, {
        where: { id: direct.parentAgentId, status: AgentStatus.APPROVED, isDeleted: 0 },
      });
      const parentLevel = parent?.levelId
        ? await manager.findOne(DistributionLevel, { where: { id: parent.levelId, isDeleted: 0 } })
        : null;
      if (parent && parentLevel?.distributionDepth === 2) {
        const rate = effectiveRate(parent.customLevel2RateBps, parentLevel.level2RateBps);
        const amount = commissionAmount(order.payAmount, rate);
        if (amount > 0)
          snapshots.push(
            this.commissionSnapshot(
              manager,
              order,
              parent,
              direct,
              parentLevel,
              2,
              rate,
              amount,
              paidTime
            )
          );
      }
    }
    if (snapshots.length) {
      await manager.save(snapshots);
      referral.frozenTime ??= new Date();
      await manager.save(referral);
    }
  }

  private commissionSnapshot(
    manager: EntityManager,
    order: BizOrder,
    beneficiary: DistributionAgent,
    source: DistributionAgent,
    level: DistributionLevel,
    depth: number,
    rateBps: number,
    amount: number,
    paidTime: Date
  ) {
    return manager.create(DistributionCommission, {
      orderId: order.id,
      orderNo: order.orderNo,
      buyerMemberId: order.memberId,
      beneficiaryAgentId: beneficiary.id,
      sourceAgentId: source.id,
      depth,
      baseAmount: order.payAmount,
      rateBps,
      commissionAmount: amount,
      agentLevelId: level.id,
      agentLevelName: level.name,
      status: CommissionStatus.WAIT_VERIFY,
      paidTime,
      isDeleted: 0,
    });
  }

  private async applyVerified(manager: EntityManager, order: BizOrder) {
    const now = order.verifyTime ?? new Date();
    const sale = await manager.findOne(DistributionDirectSale, {
      where: { orderId: order.id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (sale?.status === DirectSalesStatus.PENDING) {
      const agent = await manager.findOne(DistributionAgent, {
        where: { id: sale.agentId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (agent) {
        agent.directVerifiedSales += sale.amount;
        sale.status = DirectSalesStatus.APPLIED;
        sale.appliedTime = now;
        await manager.save([agent, sale]);
        await this.autoUpgrade(manager, agent);
      }
    }
    const commissions = await manager.find(DistributionCommission, {
      where: { orderId: order.id, status: CommissionStatus.WAIT_VERIFY, isDeleted: 0 },
    });
    for (const row of commissions) {
      row.status = CommissionStatus.WAIT_SETTLEMENT;
      row.pendingSettlementTime = now;
    }
    if (commissions.length) await manager.save(commissions);
  }

  private async reverseOrder(manager: EntityManager, order: BizOrder) {
    const now = new Date();
    const sale = await manager.findOne(DistributionDirectSale, {
      where: { orderId: order.id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (sale?.status === DirectSalesStatus.PENDING) {
      sale.status = DirectSalesStatus.REVERSED;
      sale.reversedTime = now;
      await manager.save(sale);
    }
    const commissions = await manager.find(DistributionCommission, {
      where: { orderId: order.id, status: CommissionStatus.WAIT_VERIFY, isDeleted: 0 },
    });
    for (const row of commissions) {
      row.status = CommissionStatus.REVERSED;
      row.reversedTime = now;
    }
    if (commissions.length) await manager.save(commissions);
  }

  private async autoUpgrade(manager: EntityManager, agent: DistributionAgent) {
    const current = agent.levelId
      ? await manager.findOne(DistributionLevel, { where: { id: agent.levelId, isDeleted: 0 } })
      : null;
    const levels = await manager.find(DistributionLevel, {
      where: { status: ConfigStatus.ENABLED, isDeleted: 0 },
    });
    const target = highestUpgradeLevel(levels, agent.directVerifiedSales, current?.rank ?? 0);
    if (!target) return;
    const before = this.agentSnapshot(agent);
    agent.levelId = target.id;
    await manager.save(agent);
    await this.writeLog(
      manager,
      agent.id,
      "AUTO_LEVEL",
      before,
      this.agentSnapshot(agent),
      "直属有效销售额达到升级门槛",
      null
    );
  }

  private async commissionSummary(agentId: string) {
    const rows = await this.commissionRepository
      .createQueryBuilder("c")
      .select("c.status", "status")
      .addSelect("COALESCE(SUM(c.commissionAmount), 0)", "amount")
      .where("c.beneficiaryAgentId = :agentId AND c.isDeleted = 0", { agentId })
      .groupBy("c.status")
      .getRawMany();
    const summary = { waitingVerify: 0, pendingSettlement: 0, settled: 0, reversed: 0 };
    for (const row of rows) {
      const amount = Number(row.amount);
      if (Number(row.status) === CommissionStatus.WAIT_VERIFY) summary.waitingVerify = amount;
      if (Number(row.status) === CommissionStatus.WAIT_SETTLEMENT)
        summary.pendingSettlement = amount;
      if (Number(row.status) === CommissionStatus.REVERSED) summary.reversed = amount;
      if (Number(row.status) === CommissionStatus.SETTLED) summary.settled = amount;
    }
    return summary;
  }

  private async validateAgentForm(manager: EntityManager, dto: AgentFormDto) {
    await Promise.all([
      this.findMember(dto.memberId, manager),
      this.findType(dto.typeId, true, manager),
      this.findLevel(dto.levelId, true, manager),
    ]);
    if (dto.parentAgentId) {
      const parent = await manager.findOne(DistributionAgent, {
        where: { id: dto.parentAgentId, status: AgentStatus.APPROVED, isDeleted: 0 },
      });
      if (!parent) throw this.userError("上级代理不存在或未启用");
      if (String(parent.memberId) === String(dto.memberId))
        throw this.userError("不能将自己设为上级");
    }
  }

  private async validateParent(
    manager: EntityManager,
    agentId: string,
    memberId: string,
    parentAgentId: string
  ) {
    if (String(agentId) === String(parentAgentId)) throw this.userError("不能将自己设为上级");
    let current = await manager.findOne(DistributionAgent, {
      where: { id: parentAgentId, status: AgentStatus.APPROVED, isDeleted: 0 },
    });
    if (!current) throw this.userError("上级代理不存在或未启用");
    if (String(current.memberId) === String(memberId)) throw this.userError("不能将自己设为上级");
    const visited = new Set<string>();
    while (current) {
      if (String(current.id) === String(agentId) || visited.has(String(current.id)))
        throw this.userError("代理团队不能形成循环");
      visited.add(String(current.id));
      if (!current.parentAgentId) break;
      current = await manager.findOne(DistributionAgent, {
        where: { id: current.parentAgentId, isDeleted: 0 },
      });
    }
  }

  private validateLevel(dto: DistributionLevelFormDto) {
    if (dto.distributionDepth === 1 && dto.level2RateBps !== 0)
      throw this.userError("一级分销等级的二级比例必须为0");
  }

  private async ensureTypeName(name: string, excludeId?: string) {
    const qb = this.typeRepository
      .createQueryBuilder("t")
      .where("t.name = :name AND t.isDeleted = 0", { name: name.trim() });
    if (excludeId) qb.andWhere("t.id <> :excludeId", { excludeId });
    if (await qb.getOne()) throw this.userError("代理类型名称已存在");
  }

  private async ensureLevelUnique(name: string, rank: number, excludeId?: string) {
    const qb = this.levelRepository
      .createQueryBuilder("l")
      .where("l.isDeleted = 0 AND (l.name = :name OR l.rank = :rank)", { name: name.trim(), rank });
    if (excludeId) qb.andWhere("l.id <> :excludeId", { excludeId });
    if (await qb.getOne()) throw this.userError("等级名称或顺序已存在");
  }

  private async nextInviteCode(manager: EntityManager): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = randomBytes(5).toString("hex").toUpperCase();
      if (!(await manager.findOne(DistributionAgent, { where: { inviteCode: code } }))) return code;
    }
    throw this.userError("邀请码生成失败，请重试");
  }

  private async findType(id: string, enabled = false, manager?: EntityManager) {
    const row = await (manager
      ? manager.findOne(DistributionAgentType, { where: { id, isDeleted: 0 } })
      : this.typeRepository.findOne({ where: { id, isDeleted: 0 } }));
    if (!row || (enabled && row.status !== ConfigStatus.ENABLED))
      throw this.userError("代理类型不存在或未启用");
    return row;
  }

  private async findLevel(id: string, enabled = false, manager?: EntityManager) {
    const row = await (manager
      ? manager.findOne(DistributionLevel, { where: { id, isDeleted: 0 } })
      : this.levelRepository.findOne({ where: { id, isDeleted: 0 } }));
    if (!row || (enabled && row.status !== ConfigStatus.ENABLED))
      throw this.userError("分销等级不存在或未启用");
    return row;
  }

  private async findAgent(id: string) {
    const row = await this.agentRepository.findOne({ where: { id, isDeleted: 0 } });
    if (!row) throw this.userError("代理商不存在");
    return row;
  }

  private async lockAgent(manager: EntityManager, id: string) {
    const row = await manager.findOne(DistributionAgent, {
      where: { id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!row) throw this.userError("代理商不存在");
    return row;
  }

  private async findMember(id: string, manager?: EntityManager) {
    const row = await (manager
      ? manager.findOne(Member, { where: { id, isDeleted: 0 } })
      : this.memberRepository.findOne({ where: { id, isDeleted: 0 } }));
    if (!row) throw this.userError("会员不存在");
    return row;
  }

  private agentSnapshot(agent: DistributionAgent) {
    return {
      status: agent.status,
      typeId: agent.typeId ?? null,
      levelId: agent.levelId ?? null,
      parentAgentId: agent.parentAgentId ?? null,
      customLevel1RateBps: agent.customLevel1RateBps ?? null,
      customLevel2RateBps: agent.customLevel2RateBps ?? null,
    };
  }

  private writeLog(
    manager: EntityManager,
    agentId: string,
    action: string,
    beforeValue: Record<string, unknown> | null,
    afterValue: Record<string, unknown> | null,
    reason: string,
    operatorId: string | null
  ) {
    return manager.save(
      manager.create(DistributionAgentLog, {
        agentId,
        action,
        beforeValue,
        afterValue,
        reason,
        operatorId,
        isDeleted: 0,
      })
    );
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
