import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
  type KeyLike,
} from "crypto";

export interface WechatEncryptedResource {
  algorithm: string;
  ciphertext: string;
  nonce: string;
  associated_data?: string;
}

export interface WechatSignatureHeaders {
  timestamp: string;
  nonce: string;
  serial: string;
  signature: string;
}

export function signWechatMessage(message: string, privateKey: KeyLike | string): string {
  const signer = createSign("RSA-SHA256");
  signer.update(message, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

export function verifyWechatMessage(
  message: string,
  signature: string,
  publicKey: KeyLike | string
): boolean {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message, "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

export function buildWechatRequestMessage(
  method: string,
  canonicalUrl: string,
  timestamp: string,
  nonce: string,
  body: string
): string {
  return `${method.toUpperCase()}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`;
}

export function buildWechatResponseMessage(timestamp: string, nonce: string, body: string): string {
  return `${timestamp}\n${nonce}\n${body}\n`;
}

export function buildWechatAuthorization(input: {
  method: string;
  canonicalUrl: string;
  body: string;
  mchid: string;
  serialNo: string;
  privateKey: KeyLike | string;
  timestamp?: string;
  nonce?: string;
}): string {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  const message = buildWechatRequestMessage(
    input.method,
    input.canonicalUrl,
    timestamp,
    nonce,
    input.body
  );
  const signature = signWechatMessage(message, input.privateKey);
  return (
    "WECHATPAY2-SHA256-RSA2048 " +
    `mchid="${input.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",` +
    `serial_no="${input.serialNo}",signature="${signature}"`
  );
}

export function verifyWechatSignedBody(
  headers: WechatSignatureHeaders,
  body: string,
  platformKeys: ReadonlyMap<string, KeyLike>
): void {
  const key = platformKeys.get(headers.serial);
  if (!key) throw new Error(`未知的微信支付验签密钥：${headers.serial}`);
  const message = buildWechatResponseMessage(headers.timestamp, headers.nonce, body);
  if (!verifyWechatMessage(message, headers.signature, key)) {
    throw new Error("微信支付签名验证失败");
  }
}

export function decryptWechatResourceText(
  resource: WechatEncryptedResource,
  apiV3Key: string
): string {
  if (resource.algorithm !== "AEAD_AES_256_GCM") {
    throw new Error(`不支持的微信支付加密算法：${resource.algorithm}`);
  }
  const key = Buffer.from(apiV3Key, "utf8");
  if (key.length !== 32) throw new Error("微信支付 API v3 密钥必须为32字节");

  const encrypted = Buffer.from(resource.ciphertext, "base64");
  if (encrypted.length <= 16) throw new Error("微信支付回调密文格式无效");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(resource.nonce, "utf8"));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data ?? "", "utf8"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function decryptWechatResource<T>(resource: WechatEncryptedResource, apiV3Key: string): T {
  return JSON.parse(decryptWechatResourceText(resource, apiV3Key)) as T;
}

export function parsePrivateKey(pem: string): KeyLike {
  return createPrivateKey(pem);
}

export function parsePublicKey(pem: string): KeyLike {
  return createPublicKey(pem);
}
