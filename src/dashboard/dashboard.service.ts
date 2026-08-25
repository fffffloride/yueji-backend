import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

import type { DashboardActivity, DashboardTodoItem } from "./dto/dashboard.dto";

const DAY_MS = 86_400_000;
const REFUND_TIMEOUT_MS = 30 * 60_000;

export function shanghaiDate(offsetDays = 0, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now.getTime() + offsetDays * DAY_MS));
}

export function shanghaiDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function growthRate(today: number, yesterday: number): number | null {
  return yesterday === 0 ? null : Number(((today - yesterday) / yesterday).toFixed(4));
}

export function fillTrafficTrend(
  dates: string[],
  rows: Array<{ date: string; uv: string | number; pv: string | number }>
) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return {
    uvList: dates.map((date) => Number(byDate.get(date)?.uv ?? 0)),
    pvList: dates.map((date) => Number(byDate.get(date)?.pv ?? 0)),
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async recordVisit(visitorId: string) {
    await this.dataSource.query(
      `INSERT INTO app_visit_daily
        (visit_date, visitor_id, pv_count, first_visit_time, last_visit_time)
       VALUES (CURDATE(), ?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         pv_count = pv_count + 1,
         last_visit_time = NOW()`,
      [visitorId]
    );
    return { success: true };
  }

  async getOverview(days: number) {
    const dates = Array.from({ length: days }, (_, index) => shanghaiDate(index - days + 1));
    const today = dates.at(-1)!;
    const yesterday = shanghaiDate(-1);
    const todayStart = `${today} 00:00:00`;
    const tomorrowStart = `${shanghaiDate(1)} 00:00:00`;
    const timeoutBefore = shanghaiDateTime(new Date(Date.now() - REFUND_TIMEOUT_MS));
    const timeoutTodayStart = shanghaiDateTime(
      new Date(new Date(`${today}T00:00:00+08:00`).getTime() - REFUND_TIMEOUT_MS)
    );

    const [trafficRows, memberRows, todoCountRows, todoSummaryRows, todoRows, activityRows] =
      await Promise.all([
        this.getTraffic(dates[0], today),
        this.getMembers(today, yesterday),
        this.getTodoCounts(timeoutBefore),
        this.getTodoSummary(todayStart, tomorrowStart, timeoutTodayStart, timeoutBefore),
        this.getTodoItems(timeoutBefore),
        this.getActivities(),
      ]);

    const trafficByDate = new Map(trafficRows.map((row) => [row.date, row]));
    const todayTraffic = trafficByDate.get(today);
    const yesterdayTraffic = trafficByDate.get(yesterday);
    const todayUv = Number(todayTraffic?.uv ?? 0);
    const todayPv = Number(todayTraffic?.pv ?? 0);
    const yesterdayUv = Number(yesterdayTraffic?.uv ?? 0);
    const yesterdayPv = Number(yesterdayTraffic?.pv ?? 0);
    const trend = fillTrafficTrend(dates, trafficRows);
    const members = memberRows[0] ?? { total: "0", todayNew: "0", yesterdayNew: "0" };
    const memberTotal = Number(members.total ?? 0);
    const memberTodayNew = Number(members.todayNew ?? 0);
    const memberYesterdayNew = Number(members.yesterdayNew ?? 0);
    const counts = todoCountRows[0] ?? {
      orderVerify: "0",
      agentAudit: "0",
      withdrawalAudit: "0",
      withdrawalPay: "0",
      refundError: "0",
    };
    const categories = [
      { type: "order_verify", label: "订单核销", count: Number(counts.orderVerify ?? 0) },
      { type: "agent_audit", label: "代理审核", count: Number(counts.agentAudit ?? 0) },
      {
        type: "withdrawal_audit",
        label: "提现审核",
        count: Number(counts.withdrawalAudit ?? 0),
      },
      {
        type: "withdrawal_pay",
        label: "提现打款",
        count: Number(counts.withdrawalPay ?? 0),
      },
      { type: "refund_error", label: "退款异常", count: Number(counts.refundError ?? 0) },
    ];
    const summary = todoSummaryRows[0] ?? { todayNew: "0", todayDone: "0" };

    return {
      traffic: {
        todayUv,
        todayPv,
        uvGrowthRate: growthRate(todayUv, yesterdayUv),
        pvGrowthRate: growthRate(todayPv, yesterdayPv),
        dates,
        ...trend,
      },
      members: {
        total: memberTotal,
        todayNew: memberTodayNew,
        yesterdayNew: memberYesterdayNew,
        growthRate: growthRate(memberTodayNew, memberYesterdayNew),
      },
      todos: {
        total: categories.reduce((sum, item) => sum + item.count, 0),
        todayNew: Number(summary.todayNew ?? 0),
        todayDone: Number(summary.todayDone ?? 0),
        categories,
        items: todoRows.map(this.mapTodo),
      },
      activities: activityRows.map(this.mapActivity),
    };
  }

  private getTraffic(startDate: string, endDate: string) {
    return this.dataSource.query<Array<{ date: string; uv: string; pv: string }>>(
      `SELECT DATE_FORMAT(visit_date, '%Y-%m-%d') AS date,
              COUNT(*) AS uv,
              COALESCE(SUM(pv_count), 0) AS pv
       FROM app_visit_daily
       WHERE visit_date BETWEEN ? AND ?
       GROUP BY visit_date`,
      [startDate, endDate]
    );
  }

  private getMembers(today: string, yesterday: string) {
    return this.dataSource.query<Array<{ total: string; todayNew: string; yesterdayNew: string }>>(
      `SELECT
         COUNT(CASE WHEN status = 1 AND is_deleted = 0 THEN 1 END) AS total,
         COUNT(CASE WHEN status = 1 AND is_deleted = 0 AND DATE(create_time) = ? THEN 1 END) AS todayNew,
         COUNT(CASE WHEN status = 1 AND is_deleted = 0 AND DATE(create_time) = ? THEN 1 END) AS yesterdayNew
       FROM member`,
      [today, yesterday]
    );
  }

  private getTodoCounts(timeoutBefore: string) {
    return this.dataSource.query<
      Array<{
        orderVerify: string;
        agentAudit: string;
        withdrawalAudit: string;
        withdrawalPay: string;
        refundError: string;
      }>
    >(
      `SELECT
        (SELECT COUNT(*) FROM biz_order WHERE status = 1 AND is_deleted = 0) AS orderVerify,
        (SELECT COUNT(*) FROM distribution_agent WHERE status = 0 AND is_deleted = 0) AS agentAudit,
        (SELECT COUNT(*) FROM distribution_withdrawal WHERE status = 0 AND is_deleted = 0) AS withdrawalAudit,
        (SELECT COUNT(*) FROM distribution_withdrawal WHERE status = 1 AND is_deleted = 0) AS withdrawalPay,
        (SELECT COUNT(*) FROM biz_refund
          WHERE is_deleted = 0 AND (status = 2 OR (status = 0 AND create_time <= ?))) AS refundError`,
      [timeoutBefore]
    );
  }

  private getTodoSummary(
    todayStart: string,
    tomorrowStart: string,
    timeoutTodayStart: string,
    timeoutBefore: string
  ) {
    const range = [todayStart, tomorrowStart];
    return this.dataSource.query<Array<{ todayNew: string; todayDone: string }>>(
      `SELECT
        (
          (SELECT COUNT(*) FROM biz_order WHERE is_deleted = 0 AND pay_time >= ? AND pay_time < ?) +
          (SELECT COUNT(*) FROM distribution_agent WHERE is_deleted = 0 AND apply_time >= ? AND apply_time < ?) +
          (SELECT COUNT(*) FROM distribution_withdrawal WHERE is_deleted = 0 AND create_time >= ? AND create_time < ?) +
          (SELECT COUNT(*) FROM distribution_withdrawal WHERE is_deleted = 0 AND status IN (1,3) AND review_time >= ? AND review_time < ?) +
          (SELECT COUNT(*) FROM biz_refund WHERE is_deleted = 0 AND status = 2 AND update_time >= ? AND update_time < ?) +
          (SELECT COUNT(*) FROM biz_refund WHERE is_deleted = 0 AND status = 0 AND create_time >= ? AND create_time <= ?)
        ) AS todayNew,
        (
          (SELECT COUNT(*) FROM biz_order WHERE is_deleted = 0 AND verify_time >= ? AND verify_time < ?) +
          (SELECT COUNT(*) FROM distribution_agent WHERE is_deleted = 0 AND audit_time >= ? AND audit_time < ?) +
          (SELECT COUNT(*) FROM distribution_withdrawal WHERE is_deleted = 0 AND review_time >= ? AND review_time < ?) +
          (SELECT COUNT(*) FROM distribution_withdrawal WHERE is_deleted = 0 AND paid_time >= ? AND paid_time < ?) +
          (SELECT COUNT(*) FROM biz_refund WHERE is_deleted = 0 AND status = 1 AND refund_time >= ? AND refund_time < ?)
        ) AS todayDone`,
      [
        ...range,
        ...range,
        ...range,
        ...range,
        ...range,
        timeoutTodayStart,
        timeoutBefore,
        ...range,
        ...range,
        ...range,
        ...range,
        ...range,
      ]
    );
  }

  private getTodoItems(timeoutBefore: string) {
    return this.dataSource.query<Array<Record<string, unknown>>>(
      `SELECT * FROM (
        SELECT CONCAT('order:', id) AS id, 'order_verify' AS type,
               CONCAT('订单 ', order_no, ' 待核销') AS title, '待核销' AS status,
               pay_time AS occurredAt, '/order/index' AS targetRoute
        FROM biz_order WHERE status = 1 AND is_deleted = 0
        UNION ALL
        SELECT CONCAT('agent:', id), 'agent_audit',
               CONCAT('代理申请 ', real_name, ' 待审核'), '待审核',
               COALESCE(apply_time, create_time), '/distribution/agent'
        FROM distribution_agent WHERE status = 0 AND is_deleted = 0
        UNION ALL
        SELECT CONCAT('withdrawal-review:', id), 'withdrawal_audit',
               CONCAT('提现单 ', withdrawal_no, ' 待审核'), '待审核',
               create_time, '/distribution/settlement'
        FROM distribution_withdrawal WHERE status = 0 AND is_deleted = 0
        UNION ALL
        SELECT CONCAT('withdrawal-pay:', id), 'withdrawal_pay',
               CONCAT('提现单 ', withdrawal_no, ' 待打款'), '待打款',
               COALESCE(review_time, create_time), '/distribution/settlement'
        FROM distribution_withdrawal WHERE status = 1 AND is_deleted = 0
        UNION ALL
        SELECT CONCAT('refund:', id), 'refund_error',
               CONCAT('退款单 ', refund_no, IF(status = 2, ' 处理失败', ' 处理超时')),
               IF(status = 2, '失败', '超时'), COALESCE(update_time, create_time), '/order/index'
        FROM biz_refund
        WHERE is_deleted = 0 AND (status = 2 OR (status = 0 AND create_time <= ?))
      ) todos
      ORDER BY occurredAt DESC
      LIMIT 5`,
      [timeoutBefore]
    );
  }

  private getActivities() {
    return this.dataSource.query<Array<Record<string, unknown>>>(
      `SELECT * FROM (
        SELECT CONCAT('log:', id) AS id, 'admin_log' AS type,
               CONCAT(COALESCE(operator_name, '系统'), ' ', COALESCE(title, '执行后台操作')) AS content,
               create_time AS occurredAt, NULL AS targetRoute
        FROM sys_log WHERE create_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('member:', id), 'member_created', CONCAT('新会员 ', nickname, ' 注册'),
               create_time, '/member/index'
        FROM member WHERE is_deleted = 0 AND create_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('order-created:', id), 'order_created', CONCAT('创建订单 ', order_no),
               create_time, '/order/index'
        FROM biz_order WHERE is_deleted = 0 AND create_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('order-paid:', id), 'order_paid', CONCAT('订单 ', order_no, ' 支付成功'),
               pay_time, '/order/index'
        FROM biz_order WHERE is_deleted = 0 AND pay_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('order-verified:', id), 'order_verified', CONCAT('订单 ', order_no, ' 已核销'),
               verify_time, '/order/index'
        FROM biz_order WHERE is_deleted = 0 AND verify_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('order-cancelled:', id), 'order_cancelled', CONCAT('订单 ', order_no, ' 已取消'),
               cancel_time, '/order/index'
        FROM biz_order WHERE is_deleted = 0 AND cancel_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('refund-created:', id), 'refund_created', CONCAT('退款单 ', refund_no, ' 已创建'),
               create_time, '/order/index'
        FROM biz_refund WHERE is_deleted = 0 AND create_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('refund-success:', id), 'refund_success', CONCAT('退款单 ', refund_no, ' 已完成'),
               refund_time, '/order/index'
        FROM biz_refund WHERE is_deleted = 0 AND status = 1 AND refund_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('refund-failed:', id), 'refund_failed', CONCAT('退款单 ', refund_no, ' 处理失败'),
               update_time, '/order/index'
        FROM biz_refund WHERE is_deleted = 0 AND status = 2 AND update_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('appointment:', id), 'appointment_created', CONCAT('新增预约 ', appointment_date, ' ', appointment_time),
               create_time, '/appointment/index'
        FROM appointment WHERE is_deleted = 0 AND create_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('agent-applied:', id), 'agent_applied', CONCAT('代理申请 ', real_name),
               COALESCE(apply_time, create_time), '/distribution/agent'
        FROM distribution_agent WHERE is_deleted = 0 AND COALESCE(apply_time, create_time) IS NOT NULL
        UNION ALL
        SELECT CONCAT('agent-audited:', id), 'agent_audited', CONCAT('代理 ', real_name, IF(status = 1, ' 审核通过', ' 审核完成')),
               audit_time, '/distribution/agent'
        FROM distribution_agent WHERE is_deleted = 0 AND audit_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('withdrawal-created:', id), 'withdrawal_created', CONCAT('提现单 ', withdrawal_no, ' 已创建'),
               create_time, '/distribution/settlement'
        FROM distribution_withdrawal WHERE is_deleted = 0 AND create_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('withdrawal-reviewed:', id), 'withdrawal_reviewed', CONCAT('提现单 ', withdrawal_no, IF(status = 2, ' 已驳回', ' 审核通过')),
               review_time, '/distribution/settlement'
        FROM distribution_withdrawal WHERE is_deleted = 0 AND review_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('withdrawal-paid:', id), 'withdrawal_paid', CONCAT('提现单 ', withdrawal_no, ' 已打款'),
               paid_time, '/distribution/settlement'
        FROM distribution_withdrawal WHERE is_deleted = 0 AND paid_time IS NOT NULL
        UNION ALL
        SELECT CONCAT('notice:', id), 'notice_published', CONCAT('发布通知 ', title),
               publish_time, '/system/notice'
        FROM sys_notice WHERE is_deleted = 0 AND publish_status = 1 AND publish_time IS NOT NULL
      ) activities
      ORDER BY occurredAt DESC
      LIMIT 10`
    );
  }

  private mapTodo(row: Record<string, unknown>): DashboardTodoItem {
    return {
      id: String(row.id),
      type: String(row.type),
      title: String(row.title),
      status: String(row.status),
      occurredAt: DashboardService.toIsoString(row.occurredAt),
      targetRoute: String(row.targetRoute),
    };
  }

  private mapActivity(row: Record<string, unknown>): DashboardActivity {
    const targetRoute = row.targetRoute ? String(row.targetRoute) : undefined;
    return {
      id: String(row.id),
      type: String(row.type),
      content: String(row.content),
      occurredAt: DashboardService.toIsoString(row.occurredAt),
      ...(targetRoute ? { targetRoute } : {}),
    };
  }

  private static toIsoString(value: unknown): string {
    return value instanceof Date ? value.toISOString() : String(value);
  }
}
