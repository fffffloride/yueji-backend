import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import {
  Between,
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  Repository,
} from "typeorm";

import {
  AgentStatus,
  CommissionStatus,
  DistributionProfitPoint,
  SettlementCycle,
  type SettlementCycleType,
  WithdrawalMode,
  WithdrawalStatus,
} from "./distribution.constants";
import {
  accountAmounts,
  latestDuePeriod,
  nextSettlementDate,
  periodContaining,
} from "./distribution-settlement.rules";
import {
  SettlementConfigDto,
  SettlementQueryDto,
  WithdrawalQueryDto,
} from "./dto/distribution.dto";
import { DistributionAgent } from "./entities/distribution-agent.entity";
import { DistributionCommission } from "./entities/distribution-commission.entity";
import { DistributionSettlementConfig } from "./entities/distribution-settlement-config.entity";
import { DistributionSettlement } from "./entities/distribution-settlement.entity";
import { DistributionWithdrawal } from "./entities/distribution-withdrawal.entity";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { Member } from "@/member/entities/member.entity";

@Injectable()
export class DistributionSettlementService {
  private readonly logger = new Logger(DistributionSettlementService.name);

  constructor(
    @InjectRepository(DistributionSettlementConfig)
    private readonly configRepository: Repository<DistributionSettlementConfig>,
    @InjectRepository(DistributionSettlement)
    private readonly settlementRepository: Repository<DistributionSettlement>,
    @InjectRepository(DistributionWithdrawal)
    private readonly withdrawalRepository: Repository<DistributionWithdrawal>,
    @InjectRepository(DistributionCommission)
    private readonly commissionRepository: Repository<DistributionCommission>,
    @InjectRepository(DistributionAgent)
    private readonly agentRepository: Repository<DistributionAgent>,
    private readonly dataSource: DataSource
  ) {}

  async getConfig() {
    return this.configVo(await this.ensureConfig());
  }

  async updateConfig(dto: SettlementConfigDto, operatorId: string) {
    if (dto.cycleType === SettlementCycle.WEEK && dto.settlementDay > 7) {
      throw this.userError("周结的结算日必须是星期一至星期日");
    }
    const row = await this.ensureConfig();
    Object.assign(row, dto, { updateBy: operatorId });
    return this.configVo(await this.configRepository.save(row));
  }

  async runDue(now = new Date()) {
    const config = await this.ensureConfig();
    const cycle = config.cycleType as SettlementCycleType;
    const due = latestDuePeriod(cycle, config.settlementDay, now);
    if (!due) return { settlementsCreated: 0, commissionsSettled: 0, amountSettled: 0 };

    const candidates = await this.commissionRepository.find({
      where: {
        status: CommissionStatus.WAIT_SETTLEMENT,
        settlementId: IsNull(),
        pendingSettlementTime: LessThanOrEqual(due.periodEnd),
        isDeleted: 0,
      },
      order: { pendingSettlementTime: "ASC", id: "ASC" },
    });
    const groups = new Map<string, { agentId: string; start: Date; end: Date }>();
    for (const row of candidates) {
      if (!row.pendingSettlementTime) continue;
      const period = periodContaining(cycle, row.pendingSettlementTime);
      if (period.periodEnd > due.periodEnd) continue;
      groups.set(`${row.beneficiaryAgentId}:${period.periodStart.getTime()}`, {
        agentId: row.beneficiaryAgentId,
        start: period.periodStart,
        end: period.periodEnd,
      });
    }

    let settlementsCreated = 0;
    let commissionsSettled = 0;
    let amountSettled = 0;
    for (const group of groups.values()) {
      try {
        const result = await this.settleAgentPeriod(group.agentId, group.start, group.end, now);
        if (!result) continue;
        settlementsCreated += 1;
        commissionsSettled += result.commissionCount;
        amountSettled += result.amount;
      } catch (error) {
        this.logger.warn(`分销结算失败 agentId=${group.agentId}: ${String(error)}`);
      }
    }

    const withdrawalsCreated =
      config.withdrawalMode === WithdrawalMode.AUTO
        ? await this.createAutoWithdrawals(due.periodEnd)
        : 0;
    return {
      periodStart: due.periodStart,
      periodEnd: due.periodEnd,
      settlementsCreated,
      commissionsSettled,
      amountSettled,
      withdrawalsCreated,
    };
  }

  async settlementPage(query: SettlementQueryDto) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.settlementRepository
      .createQueryBuilder("s")
      .leftJoin(DistributionAgent, "a", "a.id = s.agentId")
      .where("s.isDeleted = 0");
    if (query.agentId) qb.andWhere("s.agentId = :agentId", { agentId: query.agentId });
    if (query.profitPoint)
      qb.andWhere("s.profitPoint = :profitPoint", { profitPoint: query.profitPoint });
    if (query.startTime)
      qb.andWhere("s.periodStart >= :startTime", { startTime: new Date(query.startTime) });
    if (query.endTime) qb.andWhere("s.periodEnd <= :endTime", { endTime: new Date(query.endTime) });
    const total = await qb.getCount();
    const data = await qb
      .select([
        "s.id AS id",
        "s.settlementNo AS settlementNo",
        "s.agentId AS agentId",
        "a.realName AS agentName",
        "s.profitPoint AS profitPoint",
        "s.periodStart AS periodStart",
        "s.periodEnd AS periodEnd",
        "s.commissionCount AS commissionCount",
        "s.amount AS amount",
        "s.settledTime AS settledTime",
      ])
      .orderBy("s.id", "DESC")
      .offset((pageNum - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();
    return { data, page: { pageNum, pageSize, total } };
  }

  withdrawalPage(query: WithdrawalQueryDto, memberId?: string) {
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const qb = this.withdrawalRepository
      .createQueryBuilder("w")
      .leftJoin(DistributionAgent, "a", "a.id = w.agentId")
      .leftJoin(Member, "m", "m.id = w.memberId")
      .where("w.isDeleted = 0");
    if (memberId) qb.andWhere("w.memberId = :memberId", { memberId });
    if (query.agentId) qb.andWhere("w.agentId = :agentId", { agentId: query.agentId });
    if (query.sourceMode)
      qb.andWhere("w.sourceMode = :sourceMode", { sourceMode: query.sourceMode });
    if (query.status !== undefined) qb.andWhere("w.status = :status", { status: query.status });
    if (query.startTime)
      qb.andWhere("w.createTime >= :startTime", { startTime: new Date(query.startTime) });
    if (query.endTime)
      qb.andWhere("w.createTime <= :endTime", { endTime: new Date(query.endTime) });
    if (query.keywords)
      qb.andWhere("(w.withdrawalNo LIKE :kw OR a.realName LIKE :kw OR m.nickname LIKE :kw)", {
        kw: `%${query.keywords}%`,
      });
    return Promise.all([
      qb
        .clone()
        .select([
          "w.id AS id",
          "w.withdrawalNo AS withdrawalNo",
          "w.agentId AS agentId",
          "a.realName AS agentName",
          "w.memberId AS memberId",
          "m.nickname AS memberNickname",
          "w.sourceMode AS sourceMode",
          "w.amount AS amount",
          "w.status AS status",
          "w.reviewBy AS reviewBy",
          "w.reviewTime AS reviewTime",
          "w.reviewReason AS reviewReason",
          "w.transferNo AS transferNo",
          "w.paidBy AS paidBy",
          "w.paidTime AS paidTime",
          "w.paidRemark AS paidRemark",
          "w.autoPeriodEnd AS autoPeriodEnd",
          "w.createTime AS createTime",
        ])
        .orderBy("w.id", "DESC")
        .offset((pageNum - 1) * pageSize)
        .limit(pageSize)
        .getRawMany(),
      qb.getCount(),
    ]).then(([data, total]) => ({ data, page: { pageNum, pageSize, total } }));
  }

  async accountForMember(memberId: string) {
    const agent = await this.agentRepository.findOne({ where: { memberId, isDeleted: 0 } });
    if (!agent) throw this.userError("当前会员不是代理商");
    const [config, account] = await Promise.all([
      this.ensureConfig(),
      this.accountForAgent(agent.id),
    ]);
    return { agentId: agent.id, agentStatus: agent.status, ...this.configVo(config), ...account };
  }

  async applyWithdrawal(memberId: string, amount: number) {
    return this.dataSource.transaction(async (manager) => {
      const agent = await manager.findOne(DistributionAgent, {
        where: { memberId, isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      });
      if (!agent) throw this.userError("当前会员不是代理商");
      const config = await this.ensureConfig(manager);
      if (config.withdrawalMode !== WithdrawalMode.APPLY)
        throw this.userError("当前为系统自动提现模式");
      return this.createWithdrawal(manager, agent, amount, WithdrawalMode.APPLY, null, config);
    });
  }

  async auditWithdrawal(id: string, status: number, reason: string, operatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const row = await this.lockWithdrawal(manager, id);
      if (row.status === status) return row;
      if (row.status !== WithdrawalStatus.PENDING_REVIEW)
        throw this.userError("当前提现单不可审核");
      row.status = status;
      row.reviewBy = operatorId;
      row.reviewTime = new Date();
      row.reviewReason = reason.trim();
      return manager.save(row);
    });
  }

  async markWithdrawalPaid(
    id: string,
    transferNo: string,
    remark: string | undefined,
    operatorId: string
  ) {
    return this.dataSource.transaction(async (manager) => {
      const row = await this.lockWithdrawal(manager, id);
      if (row.status === WithdrawalStatus.PAID) return row;
      if (row.status !== WithdrawalStatus.PENDING_PAYMENT)
        throw this.userError("仅待打款提现单可确认已打款");
      row.status = WithdrawalStatus.PAID;
      row.transferNo = transferNo.trim();
      row.paidBy = operatorId;
      row.paidTime = new Date();
      row.paidRemark = remark?.trim() || null;
      return manager.save(row);
    });
  }

  private async settleAgentPeriod(agentId: string, start: Date, end: Date, now: Date) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(DistributionSettlement, {
        where: {
          agentId,
          profitPoint: DistributionProfitPoint.PRODUCT_SALES,
          periodStart: start,
          periodEnd: end,
          isDeleted: 0,
        },
      });
      if (existing) return null;
      const rows = await manager.find(DistributionCommission, {
        where: {
          beneficiaryAgentId: agentId,
          status: CommissionStatus.WAIT_SETTLEMENT,
          settlementId: IsNull(),
          pendingSettlementTime: Between(start, end),
          isDeleted: 0,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!rows.length) return null;
      const settlement = await manager.save(
        manager.create(DistributionSettlement, {
          settlementNo: this.nextNo("S"),
          agentId,
          profitPoint: DistributionProfitPoint.PRODUCT_SALES,
          periodStart: start,
          periodEnd: end,
          commissionCount: rows.length,
          amount: rows.reduce((sum, row) => sum + row.commissionAmount, 0),
          settledTime: now,
          isDeleted: 0,
        })
      );
      for (const row of rows) {
        row.status = CommissionStatus.SETTLED;
        row.settlementId = settlement.id;
        row.settledTime = now;
      }
      await manager.save(rows);
      return settlement;
    });
  }

  private async createAutoWithdrawals(periodEnd: Date) {
    const agents = await this.agentRepository.find({
      select: { id: true },
      where: { status: In([AgentStatus.APPROVED, AgentStatus.DISABLED]), isDeleted: 0 },
    });
    let count = 0;
    for (const item of agents) {
      try {
        const created = await this.dataSource.transaction(async (manager) => {
          const agent = await manager.findOne(DistributionAgent, {
            where: { id: item.id, isDeleted: 0 },
            lock: { mode: "pessimistic_write" },
          });
          if (!agent || !this.canWithdraw(agent)) return null;
          const config = await this.ensureConfig(manager);
          if (config.withdrawalMode !== WithdrawalMode.AUTO) return null;
          const existing = await manager.findOne(DistributionWithdrawal, {
            where: {
              agentId: agent.id,
              sourceMode: WithdrawalMode.AUTO,
              autoPeriodEnd: periodEnd,
              isDeleted: 0,
            },
          });
          if (existing) return null;
          const account = await this.accountForAgent(agent.id, manager);
          const amount = Math.min(account.availableAmount, config.singleLimitAmount);
          if (amount <= 0) return null;
          return this.createWithdrawal(
            manager,
            agent,
            amount,
            WithdrawalMode.AUTO,
            periodEnd,
            config
          );
        });
        if (created) count += 1;
      } catch (error) {
        this.logger.warn(`自动提现生成失败 agentId=${item.id}: ${String(error)}`);
      }
    }
    return count;
  }

  private async createWithdrawal(
    manager: EntityManager,
    agent: DistributionAgent,
    amount: number,
    sourceMode: string,
    autoPeriodEnd: Date | null,
    config: DistributionSettlementConfig
  ) {
    if (!this.canWithdraw(agent)) throw this.userError("当前代理状态不可提现");
    if (!Number.isInteger(amount) || amount <= 0) throw this.userError("提现金额必须大于0分");
    if (amount > config.singleLimitAmount) throw this.userError("提现金额超过单笔上限");
    const account = await this.accountForAgent(agent.id, manager);
    if (amount > account.availableAmount) throw this.userError("可提现余额不足");
    const member = await manager.findOne(Member, {
      where: { id: agent.memberId, isDeleted: 0 },
    });
    if (!member?.openid?.trim()) throw this.userError("代理商未绑定微信收款账号");
    return manager.save(
      manager.create(DistributionWithdrawal, {
        withdrawalNo: this.nextNo("W"),
        agentId: agent.id,
        memberId: member.id,
        sourceMode,
        amount,
        openidSnapshot: member.openid.trim(),
        status: WithdrawalStatus.PENDING_REVIEW,
        autoPeriodEnd,
        isDeleted: 0,
      })
    );
  }

  private async accountForAgent(agentId: string, manager?: EntityManager) {
    const commissions = manager
      ? manager.getRepository(DistributionCommission)
      : this.commissionRepository;
    const settlements = manager
      ? manager.getRepository(DistributionSettlement)
      : this.settlementRepository;
    const withdrawals = manager
      ? manager.getRepository(DistributionWithdrawal)
      : this.withdrawalRepository;
    const [commissionRows, settlementRow, withdrawalRows] = await Promise.all([
      commissions
        .createQueryBuilder("c")
        .select("c.status", "status")
        .addSelect("COALESCE(SUM(c.commissionAmount), 0)", "amount")
        .where("c.beneficiaryAgentId = :agentId AND c.isDeleted = 0", { agentId })
        .groupBy("c.status")
        .getRawMany(),
      settlements
        .createQueryBuilder("s")
        .select("COALESCE(SUM(s.amount), 0)", "amount")
        .where("s.agentId = :agentId AND s.isDeleted = 0", { agentId })
        .getRawOne(),
      withdrawals
        .createQueryBuilder("w")
        .select("w.status", "status")
        .addSelect("COALESCE(SUM(w.amount), 0)", "amount")
        .where("w.agentId = :agentId AND w.isDeleted = 0", { agentId })
        .groupBy("w.status")
        .getRawMany(),
    ]);
    const commissionByStatus = new Map(
      commissionRows.map((row) => [Number(row.status), Number(row.amount)])
    );
    const withdrawalByStatus = new Map(
      withdrawalRows.map((row) => [Number(row.status), Number(row.amount)])
    );
    return {
      waitingVerifyAmount: commissionByStatus.get(CommissionStatus.WAIT_VERIFY) ?? 0,
      pendingSettlementAmount: commissionByStatus.get(CommissionStatus.WAIT_SETTLEMENT) ?? 0,
      ...accountAmounts(
        Number(settlementRow?.amount ?? 0),
        withdrawalByStatus.get(WithdrawalStatus.PENDING_REVIEW) ?? 0,
        withdrawalByStatus.get(WithdrawalStatus.PENDING_PAYMENT) ?? 0,
        withdrawalByStatus.get(WithdrawalStatus.REJECTED) ?? 0,
        withdrawalByStatus.get(WithdrawalStatus.PAID) ?? 0
      ),
    };
  }

  private async ensureConfig(manager?: EntityManager) {
    const repository = manager
      ? manager.getRepository(DistributionSettlementConfig)
      : this.configRepository;
    const existing = await repository.findOne({ where: { isDeleted: 0 }, order: { id: "ASC" } });
    if (existing) return existing;
    return repository.save(
      repository.create({
        cycleType: SettlementCycle.MONTH,
        settlementDay: 1,
        withdrawalMode: WithdrawalMode.APPLY,
        singleLimitAmount: 1_000_000,
        isDeleted: 0,
      })
    );
  }

  private configVo(config: DistributionSettlementConfig) {
    return {
      id: config.id,
      cycleType: config.cycleType,
      settlementDay: config.settlementDay,
      withdrawalMode: config.withdrawalMode,
      singleLimitAmount: config.singleLimitAmount,
      nextSettlementDate: nextSettlementDate(
        config.cycleType as SettlementCycleType,
        config.settlementDay
      ),
    };
  }

  private canWithdraw(agent: DistributionAgent) {
    return [AgentStatus.APPROVED, AgentStatus.DISABLED].includes(agent.status as 1 | 3);
  }

  private async lockWithdrawal(manager: EntityManager, id: string) {
    const row = await manager.findOne(DistributionWithdrawal, {
      where: { id, isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    if (!row) throw this.userError("提现单不存在");
    return row;
  }

  private nextNo(prefix: "S" | "W") {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    return `${prefix}${stamp}${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
