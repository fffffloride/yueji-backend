import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PaymentService } from "../payment.service";
import { RefundDto } from "../dto/refund.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("17.支付管理")
@Controller("payments")
export class PaymentAdminController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: "按订单查询支付单" })
  @Get("order/:orderId")
  @Permissions("biz:order:list")
  async getByOrder(@Param("orderId") orderId: string) {
    return this.paymentService.getByOrder(orderId);
  }

  @ApiOperation({ summary: "整单退款" })
  @Post(":paymentNo/refund")
  @Permissions("biz:payment:refund")
  async refund(@Param("paymentNo") paymentNo: string, @Body() dto: RefundDto) {
    return this.paymentService.refund(paymentNo, dto.reason);
  }
}
