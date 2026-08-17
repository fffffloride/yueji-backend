import { MockPaymentDriver } from "./mock-payment.driver";

describe("MockPaymentDriver", () => {
  it("重复创建和确认保持同一支付流水", async () => {
    const driver = new MockPaymentDriver();
    const request = {
      paymentNo: "P1",
      orderNo: "O1",
      amount: 100,
      description: "test",
    };

    await expect(driver.create(request)).resolves.toMatchObject({
      paymentNo: "P1",
      status: "PENDING",
    });
    await driver.confirmCallback({ paymentNo: "P1", success: true, thirdPartyNo: "T1" });
    await expect(driver.create(request)).resolves.toMatchObject({
      paymentNo: "P1",
      status: "SUCCESS",
    });
    await expect(driver.query("P1")).resolves.toMatchObject({
      status: "SUCCESS",
      thirdPartyNo: "T1",
    });
  });

  it("退款可安全重试", async () => {
    const driver = new MockPaymentDriver();
    await driver.create({ paymentNo: "P2", orderNo: "O2", amount: 200, description: "test" });
    await driver.confirmCallback({ paymentNo: "P2", success: true });
    const request = { paymentNo: "P2", refundNo: "R2", amount: 200, reason: "test" };

    await expect(driver.refund(request)).resolves.toMatchObject({ status: "SUCCESS" });
    await expect(driver.refund(request)).resolves.toMatchObject({ status: "SUCCESS" });
  });
});
