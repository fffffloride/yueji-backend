import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  OrderGiftCreateDto,
  OrderGiftPageQueryDto,
  OrderGiftTokenDto,
} from "../dto/order-gift.dto";
import { OrderGiftService } from "../order-gift.service";
import { Public } from "@/common/decorators/auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { RateLimit } from "@/common/decorators/rate-limit.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C08.订单送礼")
@Controller("app/order-gifts")
export class OrderGiftAppController {
  constructor(private readonly orderGiftService: OrderGiftService) {}

  @ApiOperation({ summary: "创建订单赠礼分享" })
  @Post()
  @MemberAuth()
  @RateLimit({ limit: 10, windowSec: 60 })
  create(@CurrentMember() member: CurrentMemberInfo, @Body() dto: OrderGiftCreateDto) {
    return this.orderGiftService.create(member.memberId, dto.orderId);
  }

  @ApiOperation({ summary: "读取赠礼安全预览" })
  @Post("preview")
  @Public()
  @RateLimit({ limit: 60, windowSec: 60 })
  preview(@Body() dto: OrderGiftTokenDto) {
    return this.orderGiftService.preview(dto.token);
  }

  @ApiOperation({ summary: "领取订单赠礼" })
  @Post("claim")
  @MemberAuth()
  @RateLimit({ limit: 20, windowSec: 60 })
  claim(@CurrentMember() member: CurrentMemberInfo, @Body() dto: OrderGiftTokenDto) {
    return this.orderGiftService.claim(member.memberId, dto.token);
  }

  @ApiOperation({ summary: "查询我的赠礼记录" })
  @Get()
  @MemberAuth()
  page(@CurrentMember() member: CurrentMemberInfo, @Query() query: OrderGiftPageQueryDto) {
    return this.orderGiftService.page(member.memberId, query);
  }

  @ApiOperation({ summary: "撤回待领取赠礼" })
  @Post(":id/revoke")
  @MemberAuth()
  revoke(@CurrentMember() member: CurrentMemberInfo, @Param("id") id: string) {
    return this.orderGiftService.revoke(member.memberId, id);
  }

  @ApiOperation({ summary: "退回已领取赠礼" })
  @Post(":id/return")
  @MemberAuth()
  returnGift(@CurrentMember() member: CurrentMemberInfo, @Param("id") id: string) {
    return this.orderGiftService.returnGift(member.memberId, id);
  }
}
