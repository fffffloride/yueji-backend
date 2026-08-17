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
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@Injectable()
export class WechatPaymentDriver implements PaymentDriver {
  async create(_request: PaymentCreateRequest): Promise<PaymentCreateResult> {
    return this.notConfigured();
  }

  async query(_paymentNo: string): Promise<PaymentQueryResult> {
    return this.notConfigured();
  }

  async confirmCallback(_request: PaymentConfirmRequest): Promise<PaymentQueryResult> {
    return this.notConfigured();
  }

  async refund(_request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return this.notConfigured();
  }

  private notConfigured(): never {
    throw new BusinessException({
      ...ErrorCode.THIRD_PARTY_SERVICE_ERROR,
      msg: "微信支付尚未配置",
    });
  }
}
