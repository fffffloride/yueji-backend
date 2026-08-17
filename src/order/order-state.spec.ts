import { assertTransition, canTransition } from "./order-state";
import { OrderStatus } from "./order-status";

describe("order-state", () => {
  it("待付款可支付或取消", () => {
    expect(canTransition(OrderStatus.UNPAID, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.UNPAID, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.UNPAID, OrderStatus.VERIFIED)).toBe(false);
  });

  it("已付款只能核销，不能直接取消", () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.VERIFIED)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
  });

  it("已核销只能完成", () => {
    expect(canTransition(OrderStatus.VERIFIED, OrderStatus.COMPLETED)).toBe(true);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.VERIFIED)).toBe(false);
  });

  it("终态不可再流转", () => {
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.PAID)).toThrow(
      /非法订单状态流转/
    );
  });
});
