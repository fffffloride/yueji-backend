import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CouponService } from "../coupon.service";
import { PointsService } from "../points.service";
import {
  ClaimableCouponQueryDto,
  MemberCouponQueryDto,
  PointsLogQueryDto,
} from "../dto/marketing.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C06.会员权益")
@MemberAuth()
@Controller("app/marketing")
export class MarketingAppController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly couponService: CouponService
  ) {}

  @Get("account")
  account(@CurrentMember() member: CurrentMemberInfo) {
    return this.pointsService.account(member.memberId);
  }

  @Get("points/page")
  points(@CurrentMember() member: CurrentMemberInfo, @Query() query: PointsLogQueryDto) {
    return this.pointsService.page(query, member.memberId);
  }

  @Get("coupons/claimable")
  claimable(@CurrentMember() member: CurrentMemberInfo, @Query() query: ClaimableCouponQueryDto) {
    return this.couponService.claimable(member.memberId, query);
  }

  @Post("coupons/:id/claim")
  claim(@CurrentMember() member: CurrentMemberInfo, @Param("id") id: string) {
    return this.couponService.claim(member.memberId, id);
  }

  @Get("coupons/mine")
  mine(@CurrentMember() member: CurrentMemberInfo, @Query() query: MemberCouponQueryDto) {
    return this.couponService.mine(member.memberId, query);
  }
}
