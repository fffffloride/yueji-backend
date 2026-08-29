export const PAYMENT_DRIVER = Symbol("PAYMENT_DRIVER");

export interface PaymentCreateRequest {
  paymentNo: string;
  orderNo: string;
  amount: number;
  description: string;
}

export interface PaymentCreateResult {
  paymentNo: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
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
  refundNo: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  /** 成功结果必须携带渠道侧确认的整数分金额，服务端会与退款意图核对。 */
  amount?: number;
  thirdPartyNo?: string;
  refundedAt?: Date;
}

export interface PaymentDriver {
  /** create/refund 必须分别以 paymentNo/refundNo 作为渠道幂等键，允许补偿任务安全重放。 */
  create(request: PaymentCreateRequest): Promise<PaymentCreateResult>;
  query(paymentNo: string): Promise<PaymentQueryResult>;
  confirmCallback(request: PaymentConfirmRequest): Promise<PaymentQueryResult>;
  refund(request: PaymentRefundRequest): Promise<PaymentRefundResult>;
  queryRefund(refundNo: string): Promise<PaymentRefundResult>;
}
