import { buildMemberStats, PAID_MEMBER_ORDER_STATUSES } from "./member-stats";
import { OrderStatus } from "@/order/order-status";

describe("buildMemberStats", () => {
  it("有效支付金额排除待付款、取消和退款订单", () => {
    expect(PAID_MEMBER_ORDER_STATUSES).toEqual([
      OrderStatus.PAID,
      OrderStatus.VERIFIED,
      OrderStatus.COMPLETED,
    ]);
    expect(PAID_MEMBER_ORDER_STATUSES).not.toContain(OrderStatus.UNPAID);
    expect(PAID_MEMBER_ORDER_STATUSES).not.toContain(OrderStatus.CANCELLED);
    expect(PAID_MEMBER_ORDER_STATUSES).not.toContain(OrderStatus.REFUNDED);
  });

  it("计算有效支付总额、均价和状态分布", () => {
    expect(
      buildMemberStats({ orderCount: "5", totalPaid: "301", paidCount: "2" }, [
        { status: "1", count: "2" },
        { status: "4", count: "1" },
        { status: "5", count: "2" },
      ])
    ).toEqual({
      orderCount: 5,
      totalPaid: 301,
      avgPaid: 151,
      statusCounts: { 1: 2, 4: 1, 5: 2 },
    });
  });

  it("无有效支付时均价为零", () => {
    expect(buildMemberStats({ orderCount: 2, totalPaid: 0, paidCount: 0 }, [])).toMatchObject({
      orderCount: 2,
      totalPaid: 0,
      avgPaid: 0,
    });
  });
});
