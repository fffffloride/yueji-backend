import { Injectable } from "@nestjs/common";

import type {
  PaymentCreateRequest,
  PaymentCreateResult,
  PaymentDriver,
  PaymentConfirmRequest,
  PaymentQueryResult,
  PaymentRefundRequest,
  PaymentRefundResult,
} from "./payment-driver";

@Injectable()
export class MockPaymentDriver implements PaymentDriver {
  private readonly states = new Map<string, PaymentQueryResult>();
  private readonly refundStates = new Map<string, PaymentRefundResult>();

  async create(request: PaymentCreateRequest): Promise<PaymentCreateResult> {
    if (!this.states.has(request.paymentNo)) {
      this.states.set(request.paymentNo, {
        paymentNo: request.paymentNo,
        status: "PENDING",
        amount: request.amount,
      });
    }
    return {
      paymentNo: request.paymentNo,
      status: this.states.get(request.paymentNo)?.status === "SUCCESS" ? "SUCCESS" : "PENDING",
      invokeParams: { mock: true },
    };
  }

  async query(paymentNo: string): Promise<PaymentQueryResult> {
    return this.states.get(paymentNo) ?? { paymentNo, status: "PENDING" };
  }

  async confirmCallback(request: PaymentConfirmRequest): Promise<PaymentQueryResult> {
    const result: PaymentQueryResult = {
      paymentNo: request.paymentNo,
      status: request.success ? "SUCCESS" : "FAILED",
      amount: request.amount,
      thirdPartyNo: request.thirdPartyNo ?? `MOCK-${request.paymentNo}`,
      paidAt: request.success ? (request.paidAt ?? new Date()) : undefined,
    };
    this.states.set(request.paymentNo, result);
    return result;
  }

  async refund(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const existing = this.refundStates.get(request.refundNo);
    if (existing) return existing;
    const current = await this.query(request.paymentNo);
    this.states.set(request.paymentNo, {
      ...current,
      status: "REFUNDED",
    });
    const result: PaymentRefundResult = {
      refundNo: request.refundNo,
      status: "SUCCESS",
      amount: request.amount,
      thirdPartyNo: `MOCK-REFUND-${request.refundNo}`,
      refundedAt: new Date(),
    };
    this.refundStates.set(request.refundNo, result);
    return result;
  }

  async queryRefund(refundNo: string): Promise<PaymentRefundResult> {
    return this.refundStates.get(refundNo) ?? { refundNo, status: "PROCESSING" };
  }
}
