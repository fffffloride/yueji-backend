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
  thirdPartyNo?: string;
  paidAt?: Date;
}

export interface PaymentConfirmRequest {
  paymentNo: string;
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
  thirdPartyNo?: string;
  refundedAt?: Date;
}

export interface PaymentDriver {
  create(request: PaymentCreateRequest): Promise<PaymentCreateResult>;
  query(paymentNo: string): Promise<PaymentQueryResult>;
  confirmCallback(request: PaymentConfirmRequest): Promise<PaymentQueryResult>;
  refund(request: PaymentRefundRequest): Promise<PaymentRefundResult>;
}
