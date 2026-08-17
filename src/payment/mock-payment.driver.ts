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

  async create(request: PaymentCreateRequest): Promise<PaymentCreateResult> {
    if (!this.states.has(request.paymentNo)) {
      this.states.set(request.paymentNo, {
        paymentNo: request.paymentNo,
        status: "PENDING",
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
      thirdPartyNo: request.thirdPartyNo ?? `MOCK-${request.paymentNo}`,
      paidAt: request.success ? (request.paidAt ?? new Date()) : undefined,
    };
    this.states.set(request.paymentNo, result);
    return result;
  }

  async refund(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const current = await this.query(request.paymentNo);
    this.states.set(request.paymentNo, {
      ...current,
      status: "REFUNDED",
    });
    return {
      refundNo: request.refundNo,
      status: "SUCCESS",
      thirdPartyNo: `MOCK-REFUND-${request.refundNo}`,
      refundedAt: new Date(),
    };
  }
}
