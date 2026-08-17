import { OrderStatus } from "@/order/order-status";

export const PAID_MEMBER_ORDER_STATUSES: number[] = [
  OrderStatus.PAID,
  OrderStatus.VERIFIED,
  OrderStatus.COMPLETED,
];

export interface MemberOrderAggregate {
  orderCount: string | number;
  totalPaid: string | number;
  paidCount: string | number;
}

export function buildMemberStats(
  aggregate: MemberOrderAggregate | undefined,
  statusRows: { status: string | number; count: string | number }[]
) {
  const orderCount = Number(aggregate?.orderCount ?? 0);
  const totalPaid = Number(aggregate?.totalPaid ?? 0);
  const paidCount = Number(aggregate?.paidCount ?? 0);
  return {
    orderCount,
    totalPaid,
    avgPaid: paidCount === 0 ? 0 : Math.round(totalPaid / paidCount),
    statusCounts: Object.fromEntries(
      statusRows.map((row) => [Number(row.status), Number(row.count)])
    ),
  };
}
