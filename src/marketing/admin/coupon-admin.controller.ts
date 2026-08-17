import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CouponService } from "../coupon.service";
import {
  CouponIssueDto,
  CouponQueryDto,
  CouponSaveDto,
  MemberCouponQueryDto,
} from "../dto/marketing.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("19.优惠券管理")
@Controller("coupons")
export class CouponAdminController {
  constructor(private readonly service: CouponService) {}

  @Get("page")
  @Permissions("biz:coupon:list")
  page(@Query() query: CouponQueryDto) {
    return this.service.page(query);
  }

  @Get("records/page")
  @Permissions("biz:coupon:list")
  records(@Query() query: MemberCouponQueryDto) {
    return this.service.memberCouponPage(query);
  }

  @Get(":id")
  @Permissions("biz:coupon:list")
  detail(@Param("id") id: string) {
    return this.service.detail(id);
  }

  @Post()
  @Permissions("biz:coupon:create")
  create(@Body() dto: CouponSaveDto) {
    return this.service.create(dto);
  }

  @Put(":id")
  @Permissions("biz:coupon:update")
  update(@Param("id") id: string, @Body() dto: CouponSaveDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/issue")
  @Permissions("biz:coupon:issue")
  issue(@Param("id") id: string, @Body() dto: CouponIssueDto) {
    return this.service.issue(id, dto.memberIds);
  }

  @Delete(":id")
  @Permissions("biz:coupon:delete")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
