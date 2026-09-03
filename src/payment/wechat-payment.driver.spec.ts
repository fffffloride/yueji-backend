import axios from "axios";
import { createCipheriv, generateKeyPairSync, randomBytes, type KeyObject } from "crypto";

import { WechatPaymentDriver } from "./wechat-payment.driver";
import { signWechatMessage } from "./wechat-payment.crypto";

describe("WechatPaymentDriver", () => {
  const apiV3Key = "a7cde1ZJB1kG2e7VfTs3jQzaWizur8Gb";
  let merchantPrivateKey: KeyObject;
  let merchantPublicKey: KeyObject;
  let platformPrivateKey: KeyObject;
  let platformPublicPem: string;

  beforeAll(() => {
    const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
    merchantPrivateKey = merchant.privateKey;
    merchantPublicKey = merchant.publicKey;
    const platform = generateKeyPairSync("rsa", { modulusLength: 2048 });
    platformPrivateKey = platform.privateKey;
    platformPublicPem = platform.publicKey.export({ type: "spki", format: "pem" }).toString();
  });

  afterEach(() => jest.restoreAllMocks());

  function createDriver(paymentDriver = "wechat") {
    const values: Record<string, string> = {
      PAYMENT_DRIVER: paymentDriver,
      WX_MINIAPP_APP_ID: "wx-app",
      WX_PAY_MCH_ID: "1900000109",
      WX_PAY_API_V3_KEY: apiV3Key,
      WX_PAY_MERCHANT_SERIAL_NO: "MERCHANT-SERIAL",
      WX_PAY_MERCHANT_PRIVATE_KEY: merchantPrivateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString(),
      WX_PAY_PLATFORM_KEYS_JSON: JSON.stringify({ "PLATFORM-SERIAL": platformPublicPem }),
      WX_PAY_NOTIFY_URL: "https://example.com/api/v1/app/payment/wechat/notify",
      WX_PAY_REFUND_NOTIFY_URL: "https://example.com/api/v1/app/payment/wechat/refund-notify",
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    };
    return new WechatPaymentDriver(config as never);
  }

  function encrypt(payload: unknown) {
    const nonce = randomBytes(12).toString("base64url").slice(0, 12);
    const associatedData = "transaction";
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(apiV3Key), Buffer.from(nonce));
    cipher.setAAD(Buffer.from(associatedData));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
    return {
      algorithm: "AEAD_AES_256_GCM",
      associated_data: associatedData,
      nonce,
      ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
    };
  }

  function signedNotification(payload: unknown, eventType = "TRANSACTION.SUCCESS") {
    const body = JSON.stringify({
      id: "notification-1",
      event_type: eventType,
      resource: {
        ...encrypt(payload),
        original_type: eventType.startsWith("REFUND.") ? "refund" : "transaction",
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = "notification-nonce";
    return {
      body,
      headers: {
        timestamp,
        nonce,
        serial: "PLATFORM-SERIAL",
        signature: signWechatMessage(`${timestamp}\n${nonce}\n${body}\n`, platformPrivateKey),
      },
    };
  }

  function signedApiResponse(payload: unknown) {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = "response-nonce";
    return {
      status: 200,
      data: body,
      headers: {
        "wechatpay-timestamp": timestamp,
        "wechatpay-nonce": nonce,
        "wechatpay-serial": "PLATFORM-SERIAL",
        "wechatpay-signature": signWechatMessage(
          `${timestamp}\n${nonce}\n${body}\n`,
          platformPrivateKey
        ),
      },
    } as never;
  }

  it("mock 驱动模式启动时不要求微信支付配置", () => {
    expect(() => createDriver("mock").onModuleInit()).not.toThrow();
  });

  it("验签解密支付成功通知并保留渠道确认金额", () => {
    const driver = createDriver();
    const notification = signedNotification({
      appid: "wx-app",
      mchid: "1900000109",
      out_trade_no: "P1",
      transaction_id: "WX1",
      trade_state: "SUCCESS",
      success_time: "2026-09-03T12:00:00+08:00",
      amount: { total: 100, currency: "CNY" },
    });

    expect(driver.parsePaymentNotification(notification.headers, notification.body)).toMatchObject({
      paymentNo: "P1",
      status: "SUCCESS",
      amount: 100,
      thirdPartyNo: "WX1",
      appId: "wx-app",
      mchId: "1900000109",
    });
  });

  it("未知验签密钥、错误签名和错误 appid 均 fail closed", () => {
    const driver = createDriver();
    const valid = signedNotification({
      appid: "wrong-app",
      mchid: "1900000109",
      out_trade_no: "P1",
      transaction_id: "WX1",
      trade_state: "SUCCESS",
      amount: { total: 100 },
    });
    expect(() => driver.parsePaymentNotification(valid.headers, valid.body)).toThrow();
    expect(() =>
      driver.parsePaymentNotification({ ...valid.headers, serial: "UNKNOWN" }, valid.body)
    ).toThrow();
    expect(() =>
      driver.parsePaymentNotification({ ...valid.headers, signature: "invalid" }, valid.body)
    ).toThrow();
  });

  it("生成的小程序调起参数可由商户公钥验证", () => {
    const params = createDriver().buildInvokeParams("wx-prepay") as Record<string, string>;
    const verify = require("crypto").createVerify("RSA-SHA256");
    verify.update(`wx-app\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`, "utf8");
    verify.end();
    expect(verify.verify(merchantPublicKey, params.paySign, "base64")).toBe(true);
    expect(params).toMatchObject({ package: "prepay_id=wx-prepay", signType: "RSA" });
  });

  it("JSAPI 下单发送实际付款人 openid 并验签响应", async () => {
    jest.spyOn(axios, "request").mockImplementation(async () => {
      const body = JSON.stringify({ prepay_id: "wx-prepay" });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = "response-nonce";
      return {
        status: 200,
        data: body,
        headers: {
          "wechatpay-timestamp": timestamp,
          "wechatpay-nonce": nonce,
          "wechatpay-serial": "PLATFORM-SERIAL",
          "wechatpay-signature": signWechatMessage(
            `${timestamp}\n${nonce}\n${body}\n`,
            platformPrivateKey
          ),
        },
      } as never;
    });

    await expect(
      createDriver().create({
        paymentNo: "P1",
        orderNo: "O1",
        amount: 100,
        description: "悦己订单 O1",
        payerOpenid: "payer-openid",
        expireAt: new Date("2026-09-03T12:05:00+08:00"),
      })
    ).resolves.toMatchObject({ prepayId: "wx-prepay", status: "PENDING" });
    const request = (axios.request as jest.Mock).mock.calls[0][0];
    expect(JSON.parse(request.data)).toMatchObject({
      out_trade_no: "P1",
      payer: { openid: "payer-openid" },
      amount: { total: 100, currency: "CNY" },
    });
    expect(request.headers.Authorization).toContain("WECHATPAY2-SHA256-RSA2048");
  });

  it("退款响应同时校验商户支付单号、退款单号与可选商户号", async () => {
    jest.spyOn(axios, "request").mockResolvedValue(
      signedApiResponse({
        mchid: "1900000109",
        out_trade_no: "P-OTHER",
        out_refund_no: "R1",
        refund_id: "WX-R1",
        status: "PROCESSING",
      })
    );

    await expect(
      createDriver().refund({ paymentNo: "P1", refundNo: "R1", amount: 100, reason: "测试" })
    ).rejects.toBeDefined();
  });

  it("退款成功结果缺渠道退款流水号时 fail closed", async () => {
    jest.spyOn(axios, "request").mockResolvedValue(
      signedApiResponse({
        mchid: "1900000109",
        out_trade_no: "P1",
        transaction_id: "WX-P1",
        out_refund_no: "R1",
        status: "SUCCESS",
        channel: "ORIGINAL",
        user_received_account: "支付用户零钱",
        amount: { total: 100, refund: 100, currency: "CNY" },
      })
    );

    await expect(
      createDriver().refund({ paymentNo: "P1", refundNo: "R1", amount: 100, reason: "测试" })
    ).rejects.toBeDefined();
  });

  it("退款响应校验完整资金字段并识别退回商户银行卡", async () => {
    jest.spyOn(axios, "request").mockResolvedValue(
      signedApiResponse({
        mchid: "1900000109",
        out_trade_no: "P1",
        transaction_id: "WX-P1",
        out_refund_no: "R1",
        refund_id: "WX-R1",
        status: "SUCCESS",
        refund_channel: "MERCHANT_BANK_CARD",
        user_received_account: "商户结算银行账户",
        amount: { total: 100, refund: 100, currency: "CNY" },
      })
    );

    await expect(
      createDriver().refund({ paymentNo: "P1", refundNo: "R1", amount: 100, reason: "测试" })
    ).resolves.toMatchObject({
      paymentNo: "P1",
      paymentThirdPartyNo: "WX-P1",
      refundNo: "R1",
      thirdPartyNo: "WX-R1",
      status: "SUCCESS",
      paymentAmount: 100,
      amount: 100,
      currency: "CNY",
      returnedToMerchant: true,
    });
  });

  it("非成功退款响应金额不一致也 fail closed", async () => {
    jest.spyOn(axios, "request").mockResolvedValue(
      signedApiResponse({
        mchid: "1900000109",
        out_trade_no: "P1",
        transaction_id: "WX-P1",
        out_refund_no: "R1",
        refund_id: "WX-R1",
        status: "PROCESSING",
        channel: "ORIGINAL",
        user_received_account: "支付用户零钱",
        amount: { total: 100, refund: 99, currency: "CNY" },
      })
    );

    await expect(
      createDriver().refund({ paymentNo: "P1", refundNo: "R1", amount: 100, reason: "测试" })
    ).rejects.toBeDefined();
  });

  it("按微信通知格式在缺少 currency 时仍按境内 CNY 验证退款", () => {
    const notification = signedNotification(
      {
        mchid: "1900000109",
        out_trade_no: "P1",
        transaction_id: "WX-P1",
        out_refund_no: "R1",
        refund_id: "WX-R1",
        refund_status: "SUCCESS",
        success_time: "2026-09-03T12:00:00+08:00",
        user_received_account: "支付用户零钱",
        amount: { total: 100, refund: 100 },
      },
      "REFUND.SUCCESS"
    );

    expect(
      createDriver().parseRefundNotification(notification.headers, notification.body)
    ).toMatchObject({
      paymentNo: "P1",
      paymentThirdPartyNo: "WX-P1",
      refundNo: "R1",
      status: "SUCCESS",
      amount: 100,
      currency: "CNY",
      returnedToMerchant: false,
    });
  });

  it("退款原因按 UTF-8 80 字节限制并在外调前拒绝", async () => {
    const request = jest.spyOn(axios, "request");

    await expect(
      createDriver().refund({
        paymentNo: "P1",
        refundNo: "R1",
        amount: 100,
        reason: "退".repeat(27),
      })
    ).rejects.toBeDefined();
    expect(request).not.toHaveBeenCalled();
  });
});
