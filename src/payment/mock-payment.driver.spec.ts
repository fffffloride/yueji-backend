import { MockPaymentDriver } from "./mock-payment.driver";

describe("MockPaymentDriver", () => {
  const createRequest = (paymentNo: string, orderNo: string, amount: number) => ({
    paymentNo,
    orderNo,
    amount,
    description: "test",
    payerOpenid: "openid-1",
    expireAt: new Date(Date.now() + 5 * 60_000),
  });

  it("重复创建和确认保持同一支付流水", async () => {
    const driver = new MockPaymentDriver();
    const request = createRequest("P1", "O1", 100);

    await expect(driver.create(request)).resolves.toMatchObject({
      paymentNo: "P1",
      status: "PENDING",
    });
    await driver.confirmCallback({
      paymentNo: "P1",
      amount: 100,
      success: true,
      thirdPartyNo: "T1",
    });
    await expect(driver.create(request)).resolves.toMatchObject({
      paymentNo: "P1",
      status: "SUCCESS",
    });
    await expect(driver.query("P1")).resolves.toMatchObject({
      status: "SUCCESS",
      amount: 100,
      thirdPartyNo: "T1",
    });
  });

  it("退款可安全重试", async () => {
    const driver = new MockPaymentDriver();
    await driver.create(createRequest("P2", "O2", 200));
    await driver.confirmCallback({ paymentNo: "P2", amount: 200, success: true });
    const request = { paymentNo: "P2", refundNo: "R2", amount: 200, reason: "test" };

    await expect(driver.refund(request)).resolves.toMatchObject({ status: "SUCCESS" });
    await expect(driver.refund(request)).resolves.toMatchObject({ status: "SUCCESS", amount: 200 });
    await expect(driver.queryRefund("R2", "P2")).resolves.toMatchObject({
      paymentNo: "P2",
      status: "SUCCESS",
      amount: 200,
    });
  });

  it("关闭未支付尝试后允许服务层创建新尝试", async () => {
    const driver = new MockPaymentDriver();
    await driver.create(createRequest("P3", "O3", 300));

    await driver.close("P3");

    await expect(driver.query("P3")).resolves.toMatchObject({ status: "FAILED" });
  });

  it("明确区分尚未向渠道提交的退款意图", async () => {
    const driver = new MockPaymentDriver();
    await expect(driver.queryRefund("R-NOT-FOUND", "P2")).rejects.toThrow("模拟退款单不存在");
  });
});
