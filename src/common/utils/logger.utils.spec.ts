import { LoggerUtils } from "./logger.utils";

describe("LoggerUtils", () => {
  it("redacts secrets recursively without changing ordinary fields", () => {
    expect(
      LoggerUtils.redact({
        orderId: "1",
        token: "gift-token",
        nested: { mobile: "13800000000", amount: 100 },
        items: [{ password: "secret", name: "service" }],
      })
    ).toEqual({
      orderId: "1",
      token: "[REDACTED]",
      nested: { mobile: "[REDACTED]", amount: 100 },
      items: [{ password: "[REDACTED]", name: "service" }],
    });
  });
});
