import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

import {
  AnalyticsRange,
  fillAnalyticsTrend,
  normalizeAnalyticsRange,
  periodSql,
} from "./distribution-analytics.rules";
import { AgentStatus, DirectSalesStatus } from "./distribution.constants";
import {
  DistributionAgentAnalyticsQueryDto,
  DistributionAnalyticsQueryDto,
} from "./dto/distribution.dto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";
import { OrderStatus } from "@/order/order-status";

type NumberLike = string | number;

type SystemTrendRow = {
  period: string;
  totalSalesAmount: NumberLike;
  verifiedOrderCount: NumberLike;
};

type DistributionTrendRow = { period: string; distributionSalesAmount: NumberLike };

type AgentRow = {
  agentId: string;
  realName: string;
  mobile: string | null;
  levelId: string | null;
  levelName: string | null;
  status: NumberLike;
  salesAmount: NumberLike;
  orderCount: NumberLike;
  customerCount: NumberLike;
};

@Injectable()
export class DistributionAnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async overview(query: DistributionAnalyticsQueryDto) {
    const range = this.range(query.startDate, query.endDate);
    const [systemSummaryRows, directSummaryRows, systemTrend, directTrend, levels] =
      await Promise.all([
        this.systemSummary(range),
        this.directSummary(range),
        this.systemTrend(range),
        this.directTrend(range),
        this.levelStats(range),
      ]);
    const system = systemSummaryRows[0] ?? { totalSalesAmount: 0, verifiedOrderCount: 0 };
    const direct = directSummaryRows[0] ?? {
      distributionSalesAmount: 0,
      performingAgentCount: 0,
    };
    return {
      ...this.rangeVo(range),
      summary: {
        totalSalesAmount: Number(system.totalSalesAmount ?? 0),
        verifiedOrderCount: Number(system.verifiedOrderCount ?? 0),
        distributionSalesAmount: Number(direct.distributionSalesAmount ?? 0),
        performingAgentCount: Number(direct.performingAgentCount ?? 0),
      },
      trend: fillAnalyticsTrend(range.periods, systemTrend, directTrend),
      levels,
    };
  }

  async agentPage(query: DistributionAgentAnalyticsQueryDto) {
    const range = this.range(query.startDate, query.endDate);
    const pageNum = query.pageNum ?? 1;
    const pageSize = query.pageSize ?? 10;
    const { rows, total } = await this.agentRows(range, query, pageNum, pageSize);
    return { data: rows, page: { pageNum, pageSize, total } };
  }

  async agentDetail(agentId: string, query: DistributionAnalyticsQueryDto) {
    const range = this.range(query.startDate, query.endDate);
    const agent = await this.agentInfo("a.id = ?", agentId);
    if (!agent) throw this.userError("代理商不存在");
    return this.agentOverview(range, agent);
  }

  async appOverview(memberId: string, query: DistributionAnalyticsQueryDto) {
    const range = this.range(query.startDate, query.endDate);
    const agent = await this.agentInfo("a.member_id = ?", memberId);
    if (!agent) throw this.userError("代理商不存在或不可用");
    const data = await this.agentOverview(range, agent);
    return {
      startDate: data.startDate,
      endDate: data.endDate,
      granularity: data.granularity,
      summary: data.summary,
      trend: data.trend,
    };
  }

  async exportReport(query: DistributionAnalyticsQueryDto) {
    const range = this.range(query.startDate, query.endDate);
    const [overview, agents] = await Promise.all([
      this.overview(query),
      this.agentRows(range, {}, undefined, undefined),
    ]);
    return { range, overview, agents: agents.rows };
  }

  private async agentOverview(range: AnalyticsRange, agent: AgentRow) {
    const [summaryRows, trendRows] = await Promise.all([
      this.directAgentSummary(range, agent.agentId),
      this.directTrend(range, agent.agentId),
    ]);
    const summary = summaryRows[0] ?? { salesAmount: 0, orderCount: 0, customerCount: 0 };
    const trend = fillAnalyticsTrend(range.periods, [], trendRows).map((row) => ({
      period: row.period,
      salesAmount: row.distributionSalesAmount,
    }));
    return {
      ...this.rangeVo(range),
      agent: this.mapAgent(agent),
      summary: {
        salesAmount: Number(summary.salesAmount ?? 0),
        orderCount: Number(summary.orderCount ?? 0),
        customerCount: Number(summary.customerCount ?? 0),
      },
      trend,
    };
  }

  private systemSummary(range: AnalyticsRange) {
    return this.dataSource.query<
      Array<{ totalSalesAmount: NumberLike; verifiedOrderCount: NumberLike }>
    >(
      `SELECT COALESCE(SUM(pay_amount), 0) AS totalSalesAmount,
              COUNT(*) AS verifiedOrderCount
       FROM biz_order
       WHERE status = ? AND is_deleted = 0
         AND verify_time >= ? AND verify_time < ?`,
      [OrderStatus.COMPLETED, range.startTime, range.endExclusive]
    );
  }

  private directSummary(range: AnalyticsRange) {
    return this.dataSource.query<
      Array<{ distributionSalesAmount: NumberLike; performingAgentCount: NumberLike }>
    >(
      `SELECT COALESCE(SUM(amount), 0) AS distributionSalesAmount,
              COUNT(DISTINCT agent_id) AS performingAgentCount
       FROM distribution_direct_sales
       WHERE status = ? AND is_deleted = 0
         AND applied_time >= ? AND applied_time < ?`,
      [DirectSalesStatus.APPLIED, range.startTime, range.endExclusive]
    );
  }

  private systemTrend(range: AnalyticsRange) {
    const period = periodSql("verify_time", range.granularity);
    return this.dataSource.query<SystemTrendRow[]>(
      `SELECT ${period} AS period,
              SUM(pay_amount) AS totalSalesAmount,
              COUNT(*) AS verifiedOrderCount
       FROM biz_order
       WHERE status = ? AND is_deleted = 0
         AND verify_time >= ? AND verify_time < ?
       GROUP BY ${period}
       ORDER BY period`,
      [OrderStatus.COMPLETED, range.startTime, range.endExclusive]
    );
  }

  private directTrend(range: AnalyticsRange, agentId?: string) {
    const period = periodSql("applied_time", range.granularity);
    return this.dataSource.query<DistributionTrendRow[]>(
      `SELECT ${period} AS period, SUM(amount) AS distributionSalesAmount
       FROM distribution_direct_sales
       WHERE status = ? AND is_deleted = 0
         AND applied_time >= ? AND applied_time < ?
         ${agentId ? "AND agent_id = ?" : ""}
       GROUP BY ${period}
       ORDER BY period`,
      [
        DirectSalesStatus.APPLIED,
        range.startTime,
        range.endExclusive,
        ...(agentId ? [agentId] : []),
      ]
    );
  }

  private directAgentSummary(range: AnalyticsRange, agentId: string) {
    return this.dataSource.query<
      Array<{ salesAmount: NumberLike; orderCount: NumberLike; customerCount: NumberLike }>
    >(
      `SELECT COALESCE(SUM(amount), 0) AS salesAmount,
              COUNT(*) AS orderCount,
              COUNT(DISTINCT buyer_member_id) AS customerCount
       FROM distribution_direct_sales
       WHERE status = ? AND is_deleted = 0 AND agent_id = ?
         AND applied_time >= ? AND applied_time < ?`,
      [DirectSalesStatus.APPLIED, agentId, range.startTime, range.endExclusive]
    );
  }

  private async levelStats(range: AnalyticsRange) {
    const rows = await this.dataSource.query<
      Array<{
        levelId: string;
        levelName: string;
        levelRank: NumberLike;
        approvedAgentCount: NumberLike;
        disabledAgentCount: NumberLike;
        agentCount: NumberLike;
        salesAmount: NumberLike;
        orderCount: NumberLike;
        customerCount: NumberLike;
      }>
    >(
      `SELECT l.id AS levelId, l.name AS levelName, l.rank AS levelRank,
              SUM(CASE WHEN a.status = ? THEN 1 ELSE 0 END) AS approvedAgentCount,
              SUM(CASE WHEN a.status = ? THEN 1 ELSE 0 END) AS disabledAgentCount,
              COUNT(a.id) AS agentCount,
              COALESCE(SUM(s.salesAmount), 0) AS salesAmount,
              COALESCE(SUM(s.orderCount), 0) AS orderCount,
              COALESCE(SUM(s.customerCount), 0) AS customerCount
       FROM distribution_level l
       LEFT JOIN distribution_agent a
         ON a.level_id = l.id AND a.status IN (?, ?) AND a.is_deleted = 0
       LEFT JOIN (
         SELECT agent_id, SUM(amount) AS salesAmount, COUNT(*) AS orderCount,
                COUNT(DISTINCT buyer_member_id) AS customerCount
         FROM distribution_direct_sales
         WHERE status = ? AND is_deleted = 0
           AND applied_time >= ? AND applied_time < ?
         GROUP BY agent_id
       ) s ON s.agent_id = a.id
       WHERE l.is_deleted = 0
       GROUP BY l.id, l.name, l.rank
       ORDER BY l.rank, l.id`,
      [
        AgentStatus.APPROVED,
        AgentStatus.DISABLED,
        AgentStatus.APPROVED,
        AgentStatus.DISABLED,
        DirectSalesStatus.APPLIED,
        range.startTime,
        range.endExclusive,
      ]
    );
    return rows.map((row) => ({
      levelId: row.levelId,
      levelName: row.levelName,
      rank: Number(row.levelRank),
      approvedAgentCount: Number(row.approvedAgentCount ?? 0),
      disabledAgentCount: Number(row.disabledAgentCount ?? 0),
      agentCount: Number(row.agentCount ?? 0),
      salesAmount: Number(row.salesAmount ?? 0),
      orderCount: Number(row.orderCount ?? 0),
      customerCount: Number(row.customerCount ?? 0),
    }));
  }

  private async agentRows(
    range: AnalyticsRange,
    query: Pick<DistributionAgentAnalyticsQueryDto, "keywords" | "levelId">,
    pageNum?: number,
    pageSize?: number
  ) {
    const where = ["a.status IN (?, ?)", "a.is_deleted = 0"];
    const whereParams: unknown[] = [AgentStatus.APPROVED, AgentStatus.DISABLED];
    const keywords = query.keywords?.trim();
    if (keywords) {
      where.push("(a.real_name LIKE ? OR a.mobile LIKE ?)");
      whereParams.push(`%${keywords}%`, `%${keywords}%`);
    }
    if (query.levelId) {
      where.push("a.level_id = ?");
      whereParams.push(query.levelId);
    }
    const countRows = await this.dataSource.query<Array<{ total: NumberLike }>>(
      `SELECT COUNT(*) AS total FROM distribution_agent a WHERE ${where.join(" AND ")}`,
      whereParams
    );
    const limit = pageNum && pageSize ? "LIMIT ? OFFSET ?" : "";
    const paging = pageNum && pageSize ? [pageSize, (pageNum - 1) * pageSize] : [];
    const rows = await this.dataSource.query<AgentRow[]>(
      `SELECT a.id AS agentId, a.real_name AS realName, a.mobile AS mobile,
              a.level_id AS levelId, l.name AS levelName, a.status AS status,
              COALESCE(s.salesAmount, 0) AS salesAmount,
              COALESCE(s.orderCount, 0) AS orderCount,
              COALESCE(s.customerCount, 0) AS customerCount
       FROM distribution_agent a
       LEFT JOIN distribution_level l ON l.id = a.level_id AND l.is_deleted = 0
       LEFT JOIN (
         SELECT agent_id, SUM(amount) AS salesAmount, COUNT(*) AS orderCount,
                COUNT(DISTINCT buyer_member_id) AS customerCount
         FROM distribution_direct_sales
         WHERE status = ? AND is_deleted = 0
           AND applied_time >= ? AND applied_time < ?
         GROUP BY agent_id
       ) s ON s.agent_id = a.id
       WHERE ${where.join(" AND ")}
       ORDER BY salesAmount DESC, orderCount DESC, a.id ASC
       ${limit}`,
      [DirectSalesStatus.APPLIED, range.startTime, range.endExclusive, ...whereParams, ...paging]
    );
    return { rows: rows.map((row) => this.mapAgent(row)), total: Number(countRows[0]?.total ?? 0) };
  }

  private async agentInfo(condition: string, value: string) {
    const rows = await this.dataSource.query<AgentRow[]>(
      `SELECT a.id AS agentId, a.real_name AS realName, a.mobile AS mobile,
              a.level_id AS levelId, l.name AS levelName, a.status AS status,
              0 AS salesAmount, 0 AS orderCount, 0 AS customerCount
       FROM distribution_agent a
       LEFT JOIN distribution_level l ON l.id = a.level_id AND l.is_deleted = 0
       WHERE ${condition} AND a.status IN (?, ?) AND a.is_deleted = 0
       LIMIT 1`,
      [value, AgentStatus.APPROVED, AgentStatus.DISABLED]
    );
    return rows[0];
  }

  private mapAgent(row: AgentRow) {
    return {
      agentId: row.agentId,
      realName: row.realName,
      mobile: row.mobile,
      levelId: row.levelId,
      levelName: row.levelName,
      status: Number(row.status),
      salesAmount: Number(row.salesAmount ?? 0),
      orderCount: Number(row.orderCount ?? 0),
      customerCount: Number(row.customerCount ?? 0),
    };
  }

  private range(startDate?: string, endDate?: string) {
    try {
      return normalizeAnalyticsRange(startDate, endDate);
    } catch (error) {
      throw this.userError(error instanceof Error ? error.message : "日期范围无效");
    }
  }

  private rangeVo(range: AnalyticsRange) {
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      granularity: range.granularity,
    };
  }

  private userError(msg: string) {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }
}
