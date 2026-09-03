import { OrderGiftService } from "./order-gift.service";
import { OrderGiftDirection, OrderGiftStatus } from "./order-gift-status";
import { BizOrderGift } from "./entities/order-gift.entity";
import { BizOrderItem } from "./entities/order-item.entity";
import { BizOrder } from "./entities/order.entity";
import { Appointment } from "@/appointment/entities/appointment.entity";
import { GroupBuyMember } from "@/group-buy/entities/group-buy-member.entity";
import { Member } from "@/member/entities/member.entity";
import { Refund } from "@/payment/entities/refund.entity";
import { RefundStatus } from "@/payment/payment-status";

describe("OrderGiftService", () => {
  const pendingGift = (): Record<string, any> => ({
    id: "30",
    orderId: "20",
    senderMemberId: "10",
    recipientMemberId: null,
    tokenHash: "hash",
    status: OrderGiftStatus.PENDING,
    expiresAt: new Date("2099-09-10T00:00:00Z"),
    claimedAt: null,
    revokedAt: null,
    returnedAt: null,
    isDeleted: 0,
  });

  const paidOrder = (): Record<string, any> => ({
    id: "20",
    orderNo: "YJ20",
    memberId: "10",
    beneficiaryMemberId: "10",
    status: 1,
    verifyCode: "11111111",
    isDeleted: 0,
  });

  function setup() {
    const gift = pendingGift();
    const order = paidOrder();
    const giftRepository = {
      findOne: jest.fn().mockResolvedValue(gift),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const manager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === BizOrder) return Promise.resolve(order);
        if (entity === BizOrderGift) return Promise.resolve(gift);
        return Promise.resolve(null);
      }),
      find: jest.fn((entity: unknown) => {
        if (entity === BizOrder) return Promise.resolve([order]);
        if (entity === BizOrderItem) {
          return Promise.resolve([
            {
              id: "40",
              orderId: "20",
              productId: "50",
              skuId: "60",
              productName: "护理项目",
              productImage: "image",
              skuName: "单次",
              quantity: 1,
              price: 1000,
              subtotal: 1000,
            },
          ]);
        }
        if (entity === Member) {
          return Promise.resolve([
            { id: "10", nickname: "赠送人", avatar: "sender" },
            { id: "11", nickname: "领取人", avatar: "recipient" },
          ]);
        }
        return Promise.resolve([]);
      }),
      save: jest.fn(async (value: unknown) => value),
      create: jest.fn((_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      manager,
      transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === BizOrderGift) return giftRepository;
        throw new Error("unexpected repository");
      }),
    };
    return {
      service: new OrderGiftService(dataSource as never),
      dataSource,
      giftRepository,
      manager,
      gift,
      order,
    };
  }

  it("领取时锁定订单和赠礼、转移权益并轮换核销码", async () => {
    const ctx = setup();

    await expect(ctx.service.claim("11", "a".repeat(43))).resolves.toMatchObject({
      id: "30",
      status: OrderGiftStatus.CLAIMED,
      direction: OrderGiftDirection.RECEIVED,
      canBookAppointment: true,
    });

    expect(ctx.manager.findOne).toHaveBeenCalledWith(
      BizOrder,
      expect.objectContaining({ lock: { mode: "pessimistic_write" } })
    );
    expect(ctx.manager.findOne).toHaveBeenCalledWith(
      BizOrderGift,
      expect.objectContaining({ lock: { mode: "pessimistic_write" } })
    );
    expect(ctx.order.beneficiaryMemberId).toBe("11");
    expect(ctx.gift).toMatchObject({
      recipientMemberId: "11",
      status: OrderGiftStatus.CLAIMED,
    });
    expect(ctx.order.verifyCode).toMatch(/^\d{8}$/);
    expect(ctx.order.verifyCode).not.toBe("11111111");
  });

  it("退款处理中拒绝领取且不修改权益归属", async () => {
    const ctx = setup();
    ctx.manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === BizOrder) return Promise.resolve(ctx.order);
      if (entity === BizOrderGift) return Promise.resolve(ctx.gift);
      if (entity === Refund) {
        return Promise.resolve({ id: "70", status: RefundStatus.PROCESSING });
      }
      if (entity === Appointment || entity === GroupBuyMember) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    await expect(ctx.service.claim("11", "a".repeat(43))).rejects.toMatchObject({
      response: { msg: "礼物不存在或已失效" },
    });
    expect(ctx.order.beneficiaryMemberId).toBe("10");
    expect(ctx.gift.status).toBe(OrderGiftStatus.PENDING);
  });

  it("同一领取人重复提交幂等，其他会员不能读取领取人信息", async () => {
    const ctx = setup();
    ctx.gift.status = OrderGiftStatus.CLAIMED;
    ctx.gift.recipientMemberId = "11";
    ctx.order.beneficiaryMemberId = "11";

    await expect(ctx.service.claim("11", "a".repeat(43))).resolves.toMatchObject({
      id: "30",
      recipientNickname: "领取人",
    });
    await expect(ctx.service.claim("12", "a".repeat(43))).rejects.toMatchObject({
      response: { msg: "礼物不存在或已失效" },
    });
    expect(ctx.manager.save).not.toHaveBeenCalled();
  });

  it("受赠人退回时恢复购买人权益并再次轮换核销码", async () => {
    const ctx = setup();
    ctx.gift.status = OrderGiftStatus.CLAIMED;
    ctx.gift.recipientMemberId = "11";
    ctx.order.beneficiaryMemberId = "11";

    await expect(ctx.service.returnGift("11", "30")).resolves.toMatchObject({
      status: OrderGiftStatus.RETURNED,
      direction: OrderGiftDirection.RECEIVED,
    });
    expect(ctx.order.beneficiaryMemberId).toBe("10");
    expect(ctx.gift.status).toBe(OrderGiftStatus.RETURNED);
    expect(ctx.order.verifyCode).toMatch(/^\d{8}$/);
    expect(ctx.order.verifyCode).not.toBe("11111111");
  });

  it("公开预览仅返回脱敏商品字段", async () => {
    const ctx = setup();
    ctx.manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === BizOrder) return Promise.resolve(ctx.order);
      if (entity === Member) return Promise.resolve({ id: "10", nickname: "赠送人" });
      return Promise.resolve(null);
    });

    const preview = await ctx.service.preview("a".repeat(43));

    expect(preview).toMatchObject({ senderNickname: "赠送人", canClaim: true });
    expect(preview).not.toHaveProperty("orderId");
    expect(preview.items[0]).toEqual({
      id: "40",
      productId: "50",
      skuId: "60",
      productName: "护理项目",
      productImage: "image",
      skuName: "单次",
      quantity: 1,
    });
  });

  it("订单列表忽略尚未惰性落库的过期待领取记录", async () => {
    const ctx = setup();
    ctx.gift.expiresAt = new Date("2000-01-01T00:00:00Z");
    ctx.manager.find.mockImplementation((entity: unknown) => {
      if (entity === BizOrderGift) return Promise.resolve([ctx.gift]);
      return Promise.resolve([]);
    });

    const capabilities = await ctx.service.getOrderCapabilities(
      "10",
      [ctx.order as never],
      new Map()
    );

    expect(capabilities.get("20")).toMatchObject({ giftId: null, canGift: true });
  });
});
