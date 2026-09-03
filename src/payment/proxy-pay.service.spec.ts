import { createHash } from "crypto";

import { ProxyPayService, ProxyPayStatus } from "./proxy-pay.service";
import { ProxyPayShare } from "./entities/proxy-pay-share.entity";
import { Payment } from "./entities/payment.entity";
import { PaymentStatus } from "./payment-status";
import { BizOrder } from "@/order/entities/order.entity";
import { BizOrderItem } from "@/order/entities/order-item.entity";
import { OrderStatus } from "@/order/order-status";
import { GroupBuyMember } from "@/group-buy/entities/group-buy-member.entity";
import { Member } from "@/member/entities/member.entity";

describe("ProxyPayService", () => {
  const token = "abcdefghijklmnopqrstuv";
  const tokenHash = createHash("sha256").update(token).digest("hex");

  function setup(overrides: { group?: boolean; payment?: Record<string, any> | null } = {}) {
    const order: Record<string, any> = {
      id: "1",
      orderNo: "YJ-PRIVATE",
      memberId: "2",
      contactName: "隐私姓名",
      contactMobile: "13800000000",
      payAmount: 1200,
      status: OrderStatus.UNPAID,
      createTime: new Date(Date.now() - 60_000),
      isDeleted: 0,
    };
    let share: Record<string, any> | null = {
      id: "8",
      orderId: "1",
      ownerMemberId: "2",
      tokenHash,
      expiresAt: new Date(Date.now() + 29 * 60_000),
      isDeleted: 0,
    };
    const item = {
      id: "9",
      orderId: "1",
      productName: "护理项目",
      productImage: "image.png",
      skuName: "单次",
      quantity: 1,
      price: 1200,
      subtotal: 1200,
      isDeleted: 0,
    };
    const payment = overrides.payment === undefined ? null : overrides.payment;
    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === ProxyPayShare) return share;
        if (entity === BizOrder) return order;
        if (entity === Member) return { id: "2", nickname: "小悦", avatar: "avatar.png" };
        if (entity === Payment) return payment;
        return null;
      }),
      find: jest.fn(async (entity: unknown) => (entity === BizOrderItem ? [item] : [])),
      exists: jest.fn(
        async (entity: unknown) => entity === GroupBuyMember && Boolean(overrides.group)
      ),
      create: jest.fn((_entity: unknown, value: Record<string, any>) => ({ id: "8", ...value })),
      save: jest.fn(async (value: Record<string, any>) => {
        share = value;
        return value;
      }),
    };
    const dataSource = {
      manager,
      transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)),
    };
    const orderService = {
      lockForPayment: jest.fn(async (_manager: unknown, orderId: string, ownerId: string) => {
        if (orderId !== order.id || ownerId !== order.memberId) throw new Error("owner mismatch");
        return order;
      }),
    };
    const paymentService = {
      createForPayer: jest.fn().mockResolvedValue({ paymentNo: "P1", amount: 1200 }),
    };
    const configService = {
      get: jest.fn((key: string, fallback: unknown) =>
        key === "ORDER_PAY_TIMEOUT_MINUTES" ? 30 : fallback
      ),
    };
    const accessTokenService = { getAccessToken: jest.fn() };
    const service = new ProxyPayService(
      dataSource as never,
      configService as never,
      orderService as never,
      paymentService as never,
      accessTokenService as never
    );
    return {
      service,
      order,
      manager,
      orderService,
      paymentService,
      getShare: () => share,
    };
  }

  it("购买人创建 128 位随机代付令牌且数据库只保存哈希", async () => {
    const ctx = setup();

    const result = await ctx.service.createShare("2", "1");

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(ctx.getShare()).toMatchObject({ orderId: "1", ownerMemberId: "2" });
    expect(ctx.getShare()?.tokenHash).toBe(createHash("sha256").update(result.token).digest("hex"));
    expect(JSON.stringify(ctx.getShare())).not.toContain(result.token);
  });

  it("公开预览只返回安全摘要，不泄露联系人、完整订单号或会员 ID", async () => {
    const ctx = setup();

    const result = await ctx.service.preview(token);

    expect(result).toMatchObject({
      status: ProxyPayStatus.WAITING,
      statusLabel: "等待好友付款",
      ownerNickname: "小悦",
      ownerAvatar: "avatar.png",
      payAmount: 1200,
      canPay: true,
      items: [
        {
          id: "9",
          productName: "护理项目",
          productImage: "image.png",
          skuName: "单次",
          quantity: 1,
        },
      ],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("YJ-PRIVATE");
    expect(serialized).not.toContain("13800000000");
    expect(serialized).not.toContain("隐私姓名");
    expect(result).not.toHaveProperty("orderId");
    expect(result).not.toHaveProperty("ownerMemberId");
  });

  it("PAYING 的公开状态仍允许同一付款人继续，身份互斥交给支付服务", async () => {
    const ctx = setup({
      payment: {
        id: "10",
        orderId: "1",
        status: PaymentStatus.PENDING,
        expireTime: new Date(Date.now() + 5 * 60_000),
      },
    });

    await expect(ctx.service.status(token)).resolves.toMatchObject({
      status: ProxyPayStatus.PAYING,
      canPay: true,
    });
    await ctx.service.createPayment("3", "openid-3", token);
    expect(ctx.paymentService.createForPayer).toHaveBeenCalledWith("3", "openid-3", "1", "2");
  });

  it("订单剩余不足一分钟时分享和公开付款状态同时关闭", async () => {
    const ctx = setup();
    ctx.order.createTime = new Date(Date.now() - 29.5 * 60_000);
    const share = ctx.getShare();
    if (share) share.expiresAt = new Date(Date.now() + 30_000);

    await expect(ctx.service.createShare("2", "1")).rejects.toMatchObject({
      response: { msg: "当前订单不可发起好友代付" },
    });
    await expect(ctx.service.status(token)).resolves.toMatchObject({
      status: ProxyPayStatus.EXPIRED,
      canPay: false,
    });
  });

  it("拼团订单不能创建好友代付分享", async () => {
    const ctx = setup({ group: true });

    await expect(ctx.service.createShare("2", "1")).rejects.toMatchObject({
      response: { msg: "拼团订单暂不支持好友代付" },
    });
  });
});
