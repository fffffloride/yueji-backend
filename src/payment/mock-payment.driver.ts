import { Injectable } from "@nestjs/common";

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
      prepayId: `mock-${request.paymentNo}`,
      invokeParams: this.buildInvokeParams(`mock-${request.paymentNo}`),
    };
  }

  buildInvokeParams(prepayId: string): Record<string, unknown> {
    return { mock: true, prepayId };
  }

  async query(paymentNo: string): Promise<PaymentQueryResult> {
    return this.states.get(paymentNo) ?? { paymentNo, status: "PENDING" };
  }

  async close(paymentNo: string): Promise<void> {
    const current = await this.query(paymentNo);
    if (current.status === "SUCCESS" || current.status === "REFUNDED") return;
    this.states.set(paymentNo, { ...current, status: "FAILED" });
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
      paymentNo: request.paymentNo,
      paymentThirdPartyNo: current.thirdPartyNo ?? `MOCK-${request.paymentNo}`,
      refundNo: request.refundNo,
      status: "SUCCESS",
      paymentAmount: request.amount,
      amount: request.amount,
      currency: "CNY",
      thirdPartyNo: `MOCK-REFUND-${request.refundNo}`,
      refundedAt: new Date(),
      refundChannel: "ORIGINAL",
      userReceivedAccount: "支付用户零钱",
      returnedToMerchant: false,
    };
    this.refundStates.set(request.refundNo, result);
    return result;
  }

  async queryRefund(refundNo: string, paymentNo: string): Promise<PaymentRefundResult> {
    const result = this.refundStates.get(refundNo);
    if (!result) throw new PaymentRefundNotFoundError("模拟退款单不存在");
    if (result.paymentNo !== paymentNo) throw new Error("模拟退款单所属支付单不一致");
    return result;
  }
}
