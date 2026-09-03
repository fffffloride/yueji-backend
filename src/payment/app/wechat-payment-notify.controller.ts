import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  SetMetadata,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request } from "express";

import { PaymentService } from "../payment.service";
import { WechatPaymentDriver } from "../wechat-payment.driver";
import type { WechatSignatureHeaders } from "../wechat-payment.crypto";
import { Public } from "@/common/decorators/auth.decorator";
import { BusinessException } from "@/common/exceptions/business.exception";
import { ErrorCode } from "@/common/enums/error-code.enum";

@ApiExcludeController()
@Public()
@SetMetadata("skipResponseTransform", true)
@Controller("app/payment/wechat")
export class WechatPaymentNotifyController {
  constructor(
    private readonly wechatDriver: WechatPaymentDriver,
    private readonly paymentService: PaymentService
  ) {}

  @Post("notify")
  @HttpCode(HttpStatus.OK)
  async paymentNotify(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const result = this.wechatDriver.parsePaymentNotification(
      this.signatureHeaders(headers),
      this.rawBody(request)
    );
    await this.paymentService.applyWechatPaymentNotification(result);
    return { code: "SUCCESS", message: "成功" };
  }

  @Post("refund-notify")
  @HttpCode(HttpStatus.OK)
  async refundNotify(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const result = this.wechatDriver.parseRefundNotification(
      this.signatureHeaders(headers),
      this.rawBody(request)
    );
    await this.paymentService.applyWechatRefundNotification(result.paymentNo, result);
    return { code: "SUCCESS", message: "成功" };
  }

  private signatureHeaders(
    headers: Record<string, string | string[] | undefined>
  ): WechatSignatureHeaders {
    const first = (name: string) => {
      const value = headers[name];
      return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
    };
    const result = {
      timestamp: first("wechatpay-timestamp"),
      nonce: first("wechatpay-nonce"),
      serial: first("wechatpay-serial"),
      signature: first("wechatpay-signature"),
    };
    if (!result.timestamp || !result.nonce || !result.serial || !result.signature) {
      throw this.invalidNotification();
    }
    return result;
  }

  private rawBody(request: RawBodyRequest<Request>): Buffer {
    if (!request.rawBody?.length) throw this.invalidNotification();
    return request.rawBody;
  }

  private invalidNotification(): BusinessException {
    return new BusinessException({
      ...ErrorCode.THIRD_PARTY_SERVICE_ERROR,
      msg: "微信支付通知格式无效",
    });
  }
}
