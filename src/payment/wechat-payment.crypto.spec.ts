import { generateKeyPairSync } from "crypto";

import {
  buildWechatAuthorization,
  buildWechatRequestMessage,
  decryptWechatResourceText,
  signWechatMessage,
  verifyWechatMessage,
} from "./wechat-payment.crypto";

describe("wechat-payment.crypto", () => {
  it("解密微信支付官方 SDK 的 AES-256-GCM 测试向量", () => {
    expect(
      decryptWechatResourceText(
        {
          algorithm: "AEAD_AES_256_GCM",
          associated_data: "associatedData",
          nonce: "uluk4a9R25RW",
          ciphertext: "ulwSiIajGClcvcOYvOQ7+l+0PAbzzwI=",
        },
        "a7cde1ZJB1kG2e7VfTs3jQzaWizur8Gb"
      )
    ).toBe("message");
  });

  it("密文或附加数据被修改时拒绝解密", () => {
    expect(() =>
      decryptWechatResourceText(
        {
          algorithm: "AEAD_AES_256_GCM",
          associated_data: "tampered",
          nonce: "uluk4a9R25RW",
          ciphertext: "ulwSiIajGClcvcOYvOQ7+l+0PAbzzwI=",
        },
        "a7cde1ZJB1kG2e7VfTs3jQzaWizur8Gb"
      )
    ).toThrow();
  });

  it("按 API v3 规范构造请求串并使用 RSA-SHA256 签名", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const message = buildWechatRequestMessage(
      "post",
      "/v3/pay/transactions/jsapi",
      "1700000000",
      "nonce",
      '{"amount":100}'
    );
    expect(message).toBe('POST\n/v3/pay/transactions/jsapi\n1700000000\nnonce\n{"amount":100}\n');
    const signature = signWechatMessage(message, privateKey);
    expect(verifyWechatMessage(message, signature, publicKey)).toBe(true);
    expect(verifyWechatMessage(`${message}x`, signature, publicKey)).toBe(false);

    const authorization = buildWechatAuthorization({
      method: "POST",
      canonicalUrl: "/v3/pay/transactions/jsapi",
      body: '{"amount":100}',
      mchid: "1900000109",
      serialNo: "SERIAL",
      privateKey,
      timestamp: "1700000000",
      nonce: "nonce",
    });
    expect(authorization).toContain('mchid="1900000109"');
    expect(authorization).toContain('serial_no="SERIAL"');
  });
});
