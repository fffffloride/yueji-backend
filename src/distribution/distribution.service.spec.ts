import { DistributionService } from "./distribution.service";
import { AgentStatus, CommissionStatus, DirectSalesStatus } from "./distribution.constants";
import { DistributionAgent } from "./entities/distribution-agent.entity";
import { DistributionAgentLog } from "./entities/distribution-agent-log.entity";
import { DistributionCommission } from "./entities/distribution-commission.entity";
import { DistributionDirectSale } from "./entities/distribution-direct-sale.entity";
import { DistributionLevel } from "./entities/distribution-level.entity";
import { DistributionReferral } from "./entities/distribution-referral.entity";
import { BizOrder } from "@/order/entities/order.entity";
import { OrderStatus } from "@/order/order-status";

describe("DistributionService order lifecycle", () => {
  it("keeps paid, verified and refunded synchronization idempotent", async () => {
    const order: BizOrder = Object.assign(new BizOrder(), {
      id: "100",
      orderNo: "O100",
      memberId: "buyer",
      payAmount: 100_000,
      payTime: new Date("2026-08-24T00:00:00Z"),
      verifyTime: new Date("2026-08-24T01:00:00Z"),
      status: OrderStatus.PAID,
      isDeleted: 0,
    });
    const direct = Object.assign(new DistributionAgent(), {
      id: "10",
      memberId: "direct-member",
      realName: "直属代理",
      levelId: "1",
      parentAgentId: "20",
      status: AgentStatus.APPROVED,
      directVerifiedSales: 0,
      isDeleted: 0,
    });
    const parent = Object.assign(new DistributionAgent(), {
      id: "20",
      memberId: "parent-member",
      realName: "上级代理",
      levelId: "2",
      status: AgentStatus.APPROVED,
      directVerifiedSales: 0,
      isDeleted: 0,
    });
    const baseLevel = Object.assign(new DistributionLevel(), {
      id: "1",
      name: "代理",
      rank: 1,
      upgradeSalesAmount: 0,
      distributionDepth: 1,
      level1RateBps: 1000,
      level2RateBps: 0,
      status: 1,
      isDeleted: 0,
    });
    const parentLevel = Object.assign(new DistributionLevel(), {
      id: "2",
      name: "合伙人",
      rank: 2,
      upgradeSalesAmount: 50_000,
      distributionDepth: 2,
      level1RateBps: 1200,
      level2RateBps: 500,
      status: 1,
      isDeleted: 0,
    });
    const honorLevel = Object.assign(new DistributionLevel(), {
      id: "3",
      name: "荣誉股东",
      rank: 3,
      upgradeSalesAmount: 100_000,
      distributionDepth: 2,
      level1RateBps: 1500,
      level2RateBps: 800,
      status: 1,
      isDeleted: 0,
    });
    const referral = Object.assign(new DistributionReferral(), {
      id: "30",
      memberId: "buyer",
      referrerAgentId: "10",
      boundTime: new Date(),
      isDeleted: 0,
    });
    const store = new Map<Function, any[]>([
      [BizOrder, [order]],
      [DistributionAgent, [direct, parent]],
      [DistributionLevel, [baseLevel, parentLevel, honorLevel]],
      [DistributionReferral, [referral]],
      [DistributionDirectSale, []],
      [DistributionCommission, []],
      [DistributionAgentLog, []],
    ]);
    let nextId = 1000;
    const matches = (row: Record<string, unknown>, where: Record<string, any>) =>
      Object.entries(where).every(([key, expected]) => {
        if (expected && typeof expected === "object" && expected._type === "not") {
          return row[key] !== expected._value;
        }
        return String(row[key]) === String(expected);
      });
    const manager = {
      findOne: jest.fn(
        async (entity: Function, options: { where: Record<string, unknown> }) =>
          (store.get(entity) ?? []).find((row) => matches(row, options.where)) ?? null
      ),
      find: jest.fn(async (entity: Function, options: { where: Record<string, unknown> }) =>
        (store.get(entity) ?? []).filter((row) => matches(row, options.where))
      ),
      create: jest.fn((entity: new () => any, values: Record<string, unknown>) =>
        Object.assign(new entity(), values)
      ),
      save: jest.fn(async (value: any | any[]) => {
        const values = Array.isArray(value) ? value : [value];
        for (const row of values) {
          if (!row.id) row.id = String(nextId++);
          const rows = store.get(row.constructor) ?? [];
          if (!rows.includes(row)) rows.push(row);
          store.set(row.constructor, rows);
        }
        return value;
      }),
    };
    const dataSource = {
      transaction: jest.fn((work: (value: typeof manager) => unknown) => work(manager)),
    };
    const service = new DistributionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      { on: jest.fn() } as never
    );

    await service.syncOrder(order.id);
    await service.syncOrder(order.id);
    const commissions = store.get(DistributionCommission) as DistributionCommission[];
    expect(commissions.map((row) => [row.depth, row.commissionAmount])).toEqual([
      [1, 10_000],
      [2, 5_000],
    ]);
    expect(store.get(DistributionDirectSale)).toHaveLength(1);

    order.status = OrderStatus.COMPLETED;
    await service.syncOrder(order.id);
    await service.syncOrder(order.id);
    expect(commissions.every((row) => row.status === CommissionStatus.AVAILABLE)).toBe(true);
    expect(direct.directVerifiedSales).toBe(100_000);
    expect(direct.levelId).toBe(honorLevel.id);

    order.status = OrderStatus.REFUNDED;
    await service.syncOrder(order.id);
    await service.syncOrder(order.id);
    expect(commissions.every((row) => row.status === CommissionStatus.REVERSED)).toBe(true);
    expect((store.get(DistributionDirectSale) as DistributionDirectSale[])[0].status).toBe(
      DirectSalesStatus.REVERSED
    );
    expect(direct.directVerifiedSales).toBe(0);
    expect(direct.levelId).toBe(honorLevel.id);
  });
});
