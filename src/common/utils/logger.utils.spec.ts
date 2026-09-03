import { LoggerUtils } from "./logger.utils";

describe("LoggerUtils", () => {
  it("redacts secrets recursively without changing ordinary fields", () => {
    expect(
      LoggerUtils.redact({
        orderId: "1",
        token: "gift-token",
        invokeParams: {
          paySign: "signed-payment",
          package: "prepay_id=wx123",
        },
        prepayId: "wx123",
        headers: {
          "wechatpay-timestamp": "1700000000",
          "wechatpay-nonce": "callback-nonce",
          "wechatpay-serial": "platform-serial",
          "wechatpay-signature": "callback-signature",
        },
        nested: { mobile: "13800000000", amount: 100 },
        items: [{ password: "secret", name: "service" }],
      })
    ).toEqual({
      orderId: "1",
      token: "[REDACTED]",
      invokeParams: "[REDACTED]",
      prepayId: "[REDACTED]",
      headers: {
        "wechatpay-timestamp": "[REDACTED]",
        "wechatpay-nonce": "[REDACTED]",
        "wechatpay-serial": "[REDACTED]",
        "wechatpay-signature": "[REDACTED]",
      },
      nested: { mobile: "[REDACTED]", amount: 100 },
      items: [{ password: "[REDACTED]", name: "service" }],
    });
  });
});
