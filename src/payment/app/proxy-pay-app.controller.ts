import { Body, Controller, Post, Res, SetMetadata } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { ProxyPayShareDto, ProxyPayTokenDto } from "../dto/proxy-pay.dto";
import { ProxyPayService } from "../proxy-pay.service";
import { Public } from "@/common/decorators/auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { RateLimit } from "@/common/decorators/rate-limit.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C09.好友代付")
@Controller("app/proxy-pay")
export class ProxyPayAppController {
  constructor(private readonly proxyPayService: ProxyPayService) {}

  @ApiOperation({ summary: "创建好友代付分享" })
  @Post("share")
  @MemberAuth()
  @RateLimit({ limit: 10, windowSec: 60 })
  share(@CurrentMember() member: CurrentMemberInfo, @Body() dto: ProxyPayShareDto) {
    return this.proxyPayService.createShare(member.memberId, dto.orderId);
  }

  @ApiOperation({ summary: "好友代付安全预览" })
  @Post("preview")
  @Public()
  @RateLimit({ limit: 60, windowSec: 60 })
  preview(@Body() dto: ProxyPayTokenDto) {
    return this.proxyPayService.preview(dto.token);
  }

  @ApiOperation({ summary: "创建或复用好友代付支付" })
  @Post("payment")
  @MemberAuth()
  @RateLimit({ limit: 20, windowSec: 60 })
  payment(@CurrentMember() member: CurrentMemberInfo, @Body() dto: ProxyPayTokenDto) {
    return this.proxyPayService.createPayment(member.memberId, member.openid ?? "", dto.token);
  }

  @ApiOperation({ summary: "查询好友代付状态" })
  @Post("status")
  @Public()
  @RateLimit({ limit: 120, windowSec: 60 })
  status(@Body() dto: ProxyPayTokenDto) {
    return this.proxyPayService.status(dto.token);
  }

  @ApiOperation({ summary: "获取好友代付小程序码" })
  @Post("poster-code")
  @MemberAuth()
  @RateLimit({ limit: 10, windowSec: 60 })
  @SetMetadata("skipResponseTransform", true)
  async posterCode(
    @CurrentMember() member: CurrentMemberInfo,
    @Body() dto: ProxyPayTokenDto,
    @Res() response: Response
  ) {
    const image = await this.proxyPayService.posterCode(member.memberId, dto.token);
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", "private, no-store");
    response.send(image);
  }
}
