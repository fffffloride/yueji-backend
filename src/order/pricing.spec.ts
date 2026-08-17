import { calcPricing } from "./pricing";

describe("calcPricing", () => {
  it("空明细总额为 0", () => {
    expect(calcPricing([])).toEqual({
      totalAmount: 0,
      memberDiscount: 0,
      couponAmount: 0,
      pointsDeduct: 0,
      discountAmount: 0,
      payAmount: 0,
    });
  });

  it("商品总额 = 单价 × 数量之和", () => {
    const result = calcPricing([
      { price: 10000, quantity: 2 },
      { price: 5000, quantity: 1 },
    ]);
    expect(result.totalAmount).toBe(25000);
    expect(result.payAmount).toBe(25000);
    expect(result.discountAmount).toBe(0);
  });

  it("阶段3后三步为 0 时接口形状完整", () => {
    const result = calcPricing([{ price: 19900, quantity: 1 }]);
    expect(result).toMatchObject({
      memberDiscount: 0,
      couponAmount: 0,
      pointsDeduct: 0,
      discountAmount: 0,
      payAmount: 19900,
    });
  });

  it("折扣合计后实付不为负", () => {
    const result = calcPricing([{ price: 100, quantity: 1 }], {
      memberDiscount: 50,
      couponAmount: 40,
      pointsDeduct: 30,
    });
    expect(result.discountAmount).toBe(120);
    expect(result.payAmount).toBe(0);
  });
});
