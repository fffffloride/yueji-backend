import { assertTransition, canTransition } from "./order-state";
import { OrderStatus } from "./order-status";

describe("order-state", () => {
  it("待付款可支付或取消", () => {
    expect(canTransition(OrderStatus.UNPAID, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.UNPAID, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.UNPAID, OrderStatus.VERIFIED)).toBe(false);
  });

  it("已付款可核销或退款，不能直接取消", () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.VERIFIED)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
  });

  it("已核销可完成，完成后不可退款", () => {
    expect(canTransition(OrderStatus.VERIFIED, OrderStatus.COMPLETED)).toBe(true);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.VERIFIED)).toBe(false);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.REFUNDED)).toBe(false);
  });

  it("终态不可再流转", () => {
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.VERIFIED, OrderStatus.REFUNDED)).toBe(false);
    expect(() => assertTransition(OrderStatus.COMPLETED, OrderStatus.PAID)).toThrow(
      /非法订单状态流转/
    );
  });

  it("取消后收到迟到支付时只允许在原路退款完成后进入已退款", () => {
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.REFUNDED)).toBe(true);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.VERIFIED)).toBe(false);
  });
});
