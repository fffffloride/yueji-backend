import { GroupBuyMemberStatus } from "./group-buy.constants";
import { GroupBuyService } from "./group-buy.service";

describe("GroupBuyService refund settlement", () => {
  it("退款处理中不提前把拼团成员同步为已退款", async () => {
    const groupMemberRepository = {
      find: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ orderId: "O1", status: GroupBuyMemberStatus.PAID }]),
    };
    const paymentService = {
      refundByOrder: jest.fn().mockResolvedValue({ status: 0 }),
    };
    const syncOrder = jest.fn();
    const service = Object.assign(Object.create(GroupBuyService.prototype), {
      groupMemberRepository,
      orderService: { cancelUnpaidBySystem: jest.fn() },
      paymentService,
      syncOrder,
    }) as unknown as { settleFailedGroup(groupId: string): Promise<void> };

    await service.settleFailedGroup("G1");

    expect(paymentService.refundByOrder).toHaveBeenCalledWith("O1", "拼团超时未成团");
    expect(syncOrder).not.toHaveBeenCalled();
  });
});
