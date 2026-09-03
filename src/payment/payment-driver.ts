export const PAYMENT_DRIVER = Symbol("PAYMENT_DRIVER");

/** 渠道明确确认退款号不存在；只有该结果允许用原 refundNo 重提退款。 */
export class PaymentRefundNotFoundError extends Error {}

export interface PaymentCreateRequest {
  paymentNo: string;
  orderNo: string;
  amount: number;
  description: string;
  payerOpenid: string;
  expireAt: Date;
}

export interface PaymentCreateResult {
  paymentNo: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  prepayId?: string;
  invokeParams?: Record<string, unknown>;
}

export interface PaymentQueryResult {
  paymentNo: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  /** 成功结果必须携带渠道侧确认的整数分金额，服务端会与本地支付单核对。 */
  amount?: number;
  thirdPartyNo?: string;
  paidAt?: Date;
}

export interface PaymentConfirmRequest {
  paymentNo: string;
  amount: number;
  success: boolean;
  thirdPartyNo?: string;
  paidAt?: Date;
}

export interface PaymentRefundRequest {
  paymentNo: string;
  refundNo: string;
  amount: number;
  reason: string;
}

export interface PaymentRefundResult {
  paymentNo: string;
  paymentThirdPartyNo: string;
  refundNo: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "CLOSED" | "ABNORMAL";
  /** 渠道侧确认的原支付总额和退款额，所有状态都必须与本地资金意图核对。 */
  paymentAmount: number;
  amount: number;
  currency: "CNY";
  thirdPartyNo?: string;
  refundedAt?: Date;
  refundChannel?: string;
  userReceivedAccount: string;
  /** 异常退款若退到商户账户，不代表用户退款义务完成。 */
  returnedToMerchant: boolean;
}

export interface PaymentDriver {
  /** create/refund 必须分别以 paymentNo/refundNo 作为渠道幂等键，允许补偿任务安全重放。 */
  create(request: PaymentCreateRequest): Promise<PaymentCreateResult>;
  buildInvokeParams(prepayId: string): Record<string, unknown>;
  query(paymentNo: string): Promise<PaymentQueryResult>;
  close(paymentNo: string): Promise<void>;
  confirmCallback(request: PaymentConfirmRequest): Promise<PaymentQueryResult>;
  refund(request: PaymentRefundRequest): Promise<PaymentRefundResult>;
  queryRefund(refundNo: string, paymentNo: string): Promise<PaymentRefundResult>;
}
