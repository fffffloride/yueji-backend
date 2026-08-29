import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrderService } from "../order.service";
import { OrderCreateDto } from "../dto/order-create.dto";
import { AppOrderQueryDto } from "../dto/order-query.dto";
import { OrderCancelDto } from "../dto/order-verify.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";
import { RateLimit } from "@/common/decorators/rate-limit.decorator";

@ApiTags("C05.订单")
@MemberAuth()
@Controller("app/order")
export class OrderAppController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: "订单优惠试算" })
  @Post("quote")
  @RateLimit({ limit: 30, windowSec: 60 })
  async quote(@CurrentMember() member: CurrentMemberInfo, @Body() dto: OrderCreateDto) {
    return this.orderService.quote(member.memberId, dto);
  }

  @ApiOperation({ summary: "查询当前商品可用优惠券" })
  @Post("available-coupons")
  @RateLimit({ limit: 30, windowSec: 60 })
  async availableCoupons(@CurrentMember() member: CurrentMemberInfo, @Body() dto: OrderCreateDto) {
    return this.orderService.availableCoupons(member.memberId, dto);
  }

  @ApiOperation({ summary: "创建订单(扣库存)" })
  @Post()
  async create(@CurrentMember() member: CurrentMemberInfo, @Body() dto: OrderCreateDto) {
    return this.orderService.create(member.memberId, dto);
  }

  @ApiOperation({ summary: "我的订单分页" })
  @Get("page")
  async page(@CurrentMember() member: CurrentMemberInfo, @Query() query: AppOrderQueryDto) {
    return this.orderService.appPage(member.memberId, query);
  }

  @ApiOperation({ summary: "订单详情" })
  @Get(":id")
  async detail(@CurrentMember() member: CurrentMemberInfo, @Param("id") id: string) {
    return this.orderService.getDetail(id, member.memberId);
  }

  @ApiOperation({ summary: "取消待付款订单" })
  @Post(":id/cancel")
  async cancel(
    @CurrentMember() member: CurrentMemberInfo,
    @Param("id") id: string,
    @Body() dto: OrderCancelDto
  ) {
    return this.orderService.cancelByMember(member.memberId, id, dto.reason);
  }
}
