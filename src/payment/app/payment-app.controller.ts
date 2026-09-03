import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PaymentService } from "../payment.service";
import { PaymentCreateDto } from "../dto/payment-create.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C06.支付")
@MemberAuth()
@Controller("app/payment")
export class PaymentAppController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: "创建或复用支付单" })
  @Post()
  async create(@CurrentMember() member: CurrentMemberInfo, @Body() dto: PaymentCreateDto) {
    return this.paymentService.create(member.memberId, dto.orderId, member.openid ?? "");
  }

  @ApiOperation({ summary: "查询本人支付单" })
  @Get(":paymentNo")
  async query(@CurrentMember() member: CurrentMemberInfo, @Param("paymentNo") paymentNo: string) {
    return this.paymentService.queryOwned(member.memberId, paymentNo);
  }

  @ApiOperation({ summary: "模拟支付成功(仅非生产环境)" })
  @Post(":paymentNo/mock-confirm")
  async confirmMock(
    @CurrentMember() member: CurrentMemberInfo,
    @Param("paymentNo") paymentNo: string
  ) {
    return this.paymentService.confirmMock(member.memberId, paymentNo);
  }
}
