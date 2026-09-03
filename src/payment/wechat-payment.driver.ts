import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { type Method } from "axios";
import { randomBytes, type KeyLike } from "crypto";
import { readFileSync } from "fs";

import {
  PaymentCreateRequest,
  PaymentCreateResult,
  PaymentDriver,
  PaymentConfirmRequest,
  PaymentQueryResult,
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentRefundNotFoundError,
} from "./payment-driver";
import {
  buildWechatAuthorization,
  decryptWechatResource,
  parsePrivateKey,
  parsePublicKey,
  signWechatMessage,
  verifyWechatSignedBody,
  type WechatEncryptedResource,
  type WechatSignatureHeaders,
} from "./wechat-payment.crypto";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

const WECHAT_PAY_BASE_URL = "https://api.mch.weixin.qq.com";
const NOTIFICATION_MAX_AGE_SECONDS = 300;

interface WechatPaymentConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  merchantSerialNo: string;
  merchantPrivateKey: KeyLike;
  platformKeys: Map<string, KeyLike>;
  paymentNotifyUrl: string;
  refundNotifyUrl: string;
}

interface WechatNotificationEnvelope {
  id: string;
  event_type: string;
  resource: WechatEncryptedResource & { original_type?: string };
}

interface WechatPaymentPayload {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id?: string;
  trade_state: string;
  success_time?: string;
  amount?: { total?: number; currency?: string };
}

interface WechatRefundPayload {
  mchid?: string;
  out_trade_no: string;
  transaction_id?: string;
  out_refund_no: string;
  refund_id?: string;
  refund_status: string;
  channel?: string;
  refund_channel?: string;
  user_received_account?: string;
  success_time?: string;
  amount?: { total?: number; refund?: number; currency?: string };
}

interface WechatRefundResponse extends WechatRefundPayload {
  status?: string;
}

export interface WechatPaymentNotification extends PaymentQueryResult {
  appId: string;
  mchId: string;
  notificationId: string;
}

export interface WechatRefundNotification extends PaymentRefundResult {
  paymentNo: string;
  mchId: string;
  notificationId: string;
}

class WechatApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`微信支付接口请求失败：${code || status}`);
  }
}

@Injectable()
export class WechatPaymentDriver implements PaymentDriver, OnModuleInit {
  private config?: WechatPaymentConfig;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    if (this.configService.get<string>("PAYMENT_DRIVER", "mock").toLowerCase() === "wechat") {
      this.getConfig();
    }
  }

  async create(request: PaymentCreateRequest): Promise<PaymentCreateResult> {
    const config = this.getConfig();
    if (!request.payerOpenid) throw this.userError("当前会员未绑定微信身份，无法发起支付");
    if (!(request.expireAt instanceof Date) || Number.isNaN(request.expireAt.getTime())) {
      throw this.userError("支付截止时间无效");
    }

    const result = await this.request<{ prepay_id?: string }>(
      "POST",
      "/v3/pay/transactions/jsapi",
      {
        appid: config.appId,
        mchid: config.mchId,
        description: request.description.slice(0, 127),
        out_trade_no: request.paymentNo,
        time_expire: this.formatRfc3339(request.expireAt),
        notify_url: config.paymentNotifyUrl,
        amount: { total: request.amount, currency: "CNY" },
        payer: { openid: request.payerOpenid },
      }
    );
    if (!result.prepay_id) throw this.providerError("微信支付下单未返回 prepay_id");
    return {
      paymentNo: request.paymentNo,
      status: "PENDING",
      prepayId: result.prepay_id,
      invokeParams: this.buildInvokeParams(result.prepay_id),
    };
  }

  buildInvokeParams(prepayId: string): Record<string, unknown> {
    if (!prepayId) throw this.userError("微信预支付会话不存在");
    const config = this.getConfig();
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomBytes(16).toString("hex");
    const packageValue = `prepay_id=${prepayId}`;
    const paySign = signWechatMessage(
      `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`,
      config.merchantPrivateKey
    );
    return { timeStamp, nonceStr, package: packageValue, signType: "RSA", paySign };
  }

  async query(paymentNo: string): Promise<PaymentQueryResult> {
    const config = this.getConfig();
    let result: WechatPaymentPayload;
    try {
      result = await this.request<WechatPaymentPayload>(
        "GET",
        `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentNo)}?mchid=${encodeURIComponent(config.mchId)}`
      );
    } catch (error) {
      if (error instanceof WechatApiError && error.code === "ORDER_NOT_EXIST") {
        return { paymentNo, status: "FAILED" };
      }
      throw error;
    }
    this.assertPaymentIdentity(result, paymentNo);
    return this.toPaymentResult(result);
  }

  async close(paymentNo: string): Promise<void> {
    const config = this.getConfig();
    try {
      await this.request(
        "POST",
        `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentNo)}/close`,
        { mchid: config.mchId }
      );
    } catch (error) {
      if (error instanceof WechatApiError && error.code === "ORDER_NOT_EXIST") return;
      throw error;
    }
  }

  async confirmCallback(_request: PaymentConfirmRequest): Promise<PaymentQueryResult> {
    throw this.providerError("微信支付回调必须先验签并解密");
  }

  async refund(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const config = this.getConfig();
    const result = await this.request<WechatRefundResponse>("POST", "/v3/refund/domestic/refunds", {
      out_trade_no: request.paymentNo,
      out_refund_no: request.refundNo,
      reason: this.validRefundReason(request.reason),
      notify_url: config.refundNotifyUrl,
      amount: { refund: request.amount, total: request.amount, currency: "CNY" },
    });
    this.assertRefundIdentity(result, request.refundNo, request.paymentNo);
    const parsed = this.toRefundResult(result);
    if (parsed.paymentAmount !== request.amount || parsed.amount !== request.amount) {
      throw this.providerError("微信退款返回金额与提交金额不一致");
    }
    return parsed;
  }

  async queryRefund(refundNo: string, paymentNo: string): Promise<PaymentRefundResult> {
    let result: WechatRefundResponse;
    try {
      result = await this.request<WechatRefundResponse>(
        "GET",
        `/v3/refund/domestic/refunds/${encodeURIComponent(refundNo)}`
      );
    } catch (error) {
      if (
        error instanceof WechatApiError &&
        ["RESOURCE_NOT_EXISTS", "REFUND_NOT_EXIST"].includes(error.code)
      ) {
        throw new PaymentRefundNotFoundError("微信退款单不存在");
      }
      throw error;
    }
    this.assertRefundIdentity(result, refundNo, paymentNo);
    return this.toRefundResult(result);
  }

  parsePaymentNotification(
    headers: WechatSignatureHeaders,
    rawBody: Buffer | string
  ): WechatPaymentNotification {
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
    this.verifyNotification(headers, body);
    const envelope = this.parseEnvelope(body);
    if (envelope.event_type !== "TRANSACTION.SUCCESS") {
      throw this.providerError("微信支付通知事件类型无效");
    }
    if (envelope.resource.original_type !== "transaction") {
      throw this.providerError("微信支付通知资源类型无效");
    }
    const payload = this.decrypt<WechatPaymentPayload>(envelope.resource);
    if (!payload.out_trade_no) throw this.providerError("微信支付通知缺少商户支付单号");
    this.assertPaymentIdentity(payload, payload.out_trade_no);
    const result = this.toPaymentResult(payload);
    if (result.status !== "SUCCESS") throw this.providerError("微信支付成功通知状态无效");
    return {
      ...result,
      appId: payload.appid,
      mchId: payload.mchid,
      notificationId: envelope.id,
    };
  }

  parseRefundNotification(
    headers: WechatSignatureHeaders,
    rawBody: Buffer | string
  ): WechatRefundNotification {
    const config = this.getConfig();
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
    this.verifyNotification(headers, body);
    const envelope = this.parseEnvelope(body);
    if (!envelope.event_type.startsWith("REFUND.")) {
      throw this.providerError("微信退款通知事件类型无效");
    }
    if (envelope.resource.original_type !== "refund") {
      throw this.providerError("微信退款通知资源类型无效");
    }
    const payload = this.decrypt<WechatRefundPayload>(envelope.resource);
    if (payload.mchid !== config.mchId || !payload.out_trade_no || !payload.out_refund_no) {
      throw this.providerError("微信退款通知商户或单号不一致");
    }
    return {
      // 微信退款通知的 amount 不携带 currency；验签、商户号和单号校验后按境内退款固定为 CNY。
      ...this.toRefundResult(payload, true),
      paymentNo: payload.out_trade_no,
      mchId: payload.mchid,
      notificationId: envelope.id,
    };
  }

  private async request<T = Record<string, never>>(
    method: Method,
    canonicalUrl: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const config = this.getConfig();
    const body = data ? JSON.stringify(data) : "";
    const authorization = buildWechatAuthorization({
      method,
      canonicalUrl,
      body,
      mchid: config.mchId,
      serialNo: config.merchantSerialNo,
      privateKey: config.merchantPrivateKey,
    });

    let response;
    try {
      response = await axios.request<string>({
        baseURL: WECHAT_PAY_BASE_URL,
        url: canonicalUrl,
        method,
        data: body || undefined,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authorization,
        },
        transformResponse: [(value) => value],
        validateStatus: () => true,
        timeout: 10_000,
      });
    } catch {
      throw this.providerError("微信支付网络请求失败");
    }

    const responseBody =
      typeof response.data === "string" ? response.data : String(response.data ?? "");
    const signatureHeaders = this.signatureHeaders(response.headers);
    try {
      verifyWechatSignedBody(signatureHeaders, responseBody, config.platformKeys);
    } catch {
      throw this.providerError("微信支付响应验签失败");
    }

    if (response.status < 200 || response.status >= 300) {
      const errorBody = this.parseJson<{ code?: string }>(responseBody, {});
      throw new WechatApiError(response.status, errorBody.code ?? "UNKNOWN");
    }
    if (!responseBody) return {} as T;
    return this.parseJson<T>(responseBody);
  }

  private verifyNotification(headers: WechatSignatureHeaders, body: string): void {
    const timestamp = Number(headers.timestamp);
    if (
      !Number.isInteger(timestamp) ||
      Math.abs(Date.now() / 1000 - timestamp) > NOTIFICATION_MAX_AGE_SECONDS
    ) {
      throw this.providerError("微信支付通知时间戳无效");
    }
    try {
      verifyWechatSignedBody(headers, body, this.getConfig().platformKeys);
    } catch {
      throw this.providerError("微信支付通知验签失败");
    }
  }

  private signatureHeaders(headers: Record<string, unknown>): WechatSignatureHeaders {
    const value = (name: string) => {
      const header = headers[name] ?? headers[name.toLowerCase()];
      if (Array.isArray(header)) return String(header[0] ?? "");
      return String(header ?? "");
    };
    const result = {
      timestamp: value("wechatpay-timestamp"),
      nonce: value("wechatpay-nonce"),
      serial: value("wechatpay-serial"),
      signature: value("wechatpay-signature"),
    };
    if (!result.timestamp || !result.nonce || !result.serial || !result.signature) {
      throw this.providerError("微信支付响应缺少验签头");
    }
    return result;
  }

  private parseEnvelope(body: string): WechatNotificationEnvelope {
    const envelope = this.parseJson<WechatNotificationEnvelope>(body);
    if (!envelope.id || !envelope.event_type || !envelope.resource?.ciphertext) {
      throw this.providerError("微信支付通知格式无效");
    }
    return envelope;
  }

  private decrypt<T>(resource: WechatEncryptedResource): T {
    try {
      return decryptWechatResource<T>(resource, this.getConfig().apiV3Key);
    } catch {
      throw this.providerError("微信支付通知解密失败");
    }
  }

  private assertPaymentIdentity(payload: WechatPaymentPayload, paymentNo: string): void {
    const config = this.getConfig();
    if (
      payload.appid !== config.appId ||
      payload.mchid !== config.mchId ||
      payload.out_trade_no !== paymentNo
    ) {
      throw this.providerError("微信支付返回的商户或支付单号不一致");
    }
  }

  private toPaymentResult(payload: WechatPaymentPayload): PaymentQueryResult {
    const paymentNo = payload.out_trade_no;
    switch (payload.trade_state) {
      case "SUCCESS":
        if (
          !payload.transaction_id ||
          !Number.isInteger(payload.amount?.total) ||
          payload.amount?.currency !== "CNY"
        ) {
          throw this.providerError("微信支付成功结果缺少金额或流水号");
        }
        return {
          paymentNo,
          status: "SUCCESS",
          amount: payload.amount?.total,
          thirdPartyNo: payload.transaction_id,
          paidAt: this.parseDate(payload.success_time),
        };
      case "REFUND":
        return { paymentNo, status: "REFUNDED" };
      case "NOTPAY":
      case "USERPAYING":
        return { paymentNo, status: "PENDING" };
      case "CLOSED":
      case "REVOKED":
      case "PAYERROR":
        return { paymentNo, status: "FAILED" };
      default:
        throw this.providerError("微信支付返回未知交易状态");
    }
  }

  private toRefundResult(
    payload: WechatRefundResponse,
    allowImplicitCny = false
  ): PaymentRefundResult {
    const paymentNo = payload.out_trade_no;
    const refundNo = payload.out_refund_no;
    const status = payload.refund_status ?? payload.status;
    if (
      !payload.refund_id ||
      !payload.transaction_id ||
      !Number.isInteger(payload.amount?.total) ||
      !Number.isInteger(payload.amount?.refund) ||
      (payload.amount?.currency ?? (allowImplicitCny ? "CNY" : undefined)) !== "CNY" ||
      !payload.user_received_account
    ) {
      throw this.providerError("微信退款结果缺少渠道流水、金额、币种或入账账户");
    }
    const refundChannel = payload.channel ?? payload.refund_channel;
    const returnedToMerchant =
      refundChannel === "MERCHANT_BANK_CARD" ||
      /商户(?:基本账户|结算银行账户)/u.test(payload.user_received_account);
    const common = {
      paymentNo,
      paymentThirdPartyNo: payload.transaction_id,
      refundNo,
      paymentAmount: payload.amount.total,
      amount: payload.amount.refund,
      currency: "CNY" as const,
      thirdPartyNo: payload.refund_id,
      refundChannel,
      userReceivedAccount: payload.user_received_account,
      returnedToMerchant,
    };
    switch (status) {
      case "SUCCESS":
        return {
          ...common,
          status: "SUCCESS",
          refundedAt: this.parseDate(payload.success_time),
        };
      case "PROCESSING":
        return { ...common, status: "PROCESSING" };
      case "CLOSED":
        return { ...common, status: "CLOSED" };
      case "ABNORMAL":
        return { ...common, status: "ABNORMAL" };
      default:
        throw this.providerError("微信支付返回未知退款状态");
    }
  }

  private assertRefundIdentity(
    payload: WechatRefundResponse,
    refundNo: string,
    paymentNo: string
  ): void {
    const config = this.getConfig();
    if (
      payload.out_refund_no !== refundNo ||
      payload.out_trade_no !== paymentNo ||
      (payload.mchid !== undefined && payload.mchid !== config.mchId)
    ) {
      throw this.providerError("微信支付返回的退款单身份不一致");
    }
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw this.providerError("微信支付返回时间格式无效");
    return parsed;
  }

  private parseJson<T>(body: string, fallback?: T): T {
    if (!body && fallback !== undefined) return fallback;
    try {
      return JSON.parse(body) as T;
    } catch {
      if (fallback !== undefined) return fallback;
      throw this.providerError("微信支付返回 JSON 格式无效");
    }
  }

  private formatRfc3339(date: Date): string {
    const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return `${shifted.toISOString().slice(0, 19)}+08:00`;
  }

  private validRefundReason(reason: string): string {
    const normalized = reason.trim();
    if (!normalized || Buffer.byteLength(normalized, "utf8") > 80) {
      throw this.userError("退款原因不能为空且不能超过80字节");
    }
    return normalized;
  }

  private getConfig(): WechatPaymentConfig {
    if (this.config) return this.config;
    const required = (key: string) => {
      const value = this.configService.get<string>(key)?.trim();
      if (!value) throw new Error(`微信支付缺少必需配置：${key}`);
      return value;
    };
    const privateKeyValue =
      this.configService.get<string>("WX_PAY_MERCHANT_PRIVATE_KEY")?.trim() ||
      this.readConfiguredFile("WX_PAY_MERCHANT_PRIVATE_KEY_PATH");
    if (!privateKeyValue) {
      throw new Error(
        "微信支付缺少必需配置：WX_PAY_MERCHANT_PRIVATE_KEY 或 WX_PAY_MERCHANT_PRIVATE_KEY_PATH"
      );
    }

    const rawKeys = required("WX_PAY_PLATFORM_KEYS_JSON");
    let parsedKeys: Record<string, string>;
    try {
      parsedKeys = JSON.parse(rawKeys) as Record<string, string>;
    } catch {
      throw new Error("WX_PAY_PLATFORM_KEYS_JSON 必须是 serial/public-key-id 到 PEM 的 JSON 对象");
    }
    const platformKeys = new Map<string, KeyLike>();
    for (const [id, pem] of Object.entries(parsedKeys)) {
      if (!id.trim() || typeof pem !== "string" || !pem.trim()) continue;
      platformKeys.set(id.trim(), parsePublicKey(this.normalizePem(pem)));
    }
    if (platformKeys.size === 0) throw new Error("WX_PAY_PLATFORM_KEYS_JSON 未包含有效验签密钥");

    const apiV3Key = required("WX_PAY_API_V3_KEY");
    if (Buffer.byteLength(apiV3Key, "utf8") !== 32) {
      throw new Error("WX_PAY_API_V3_KEY 必须为32字节");
    }
    this.config = {
      appId: required("WX_MINIAPP_APP_ID"),
      mchId: required("WX_PAY_MCH_ID"),
      apiV3Key,
      merchantSerialNo: required("WX_PAY_MERCHANT_SERIAL_NO"),
      merchantPrivateKey: parsePrivateKey(this.normalizePem(privateKeyValue)),
      platformKeys,
      paymentNotifyUrl: required("WX_PAY_NOTIFY_URL"),
      refundNotifyUrl: required("WX_PAY_REFUND_NOTIFY_URL"),
    };
    return this.config;
  }

  private readConfiguredFile(key: string): string {
    const path = this.configService.get<string>(key)?.trim();
    if (!path) return "";
    return readFileSync(path, "utf8");
  }

  private normalizePem(value: string): string {
    return value.replace(/\\n/g, "\n");
  }

  private userError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.USER_ERROR, msg });
  }

  private providerError(msg: string): BusinessException {
    return new BusinessException({ ...ErrorCode.THIRD_PARTY_SERVICE_ERROR, msg });
  }
}
