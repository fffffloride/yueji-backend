import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { DecorationService } from "../decoration.service";
import {
  BannerFormDto,
  BrandFormDto,
  DecorationQueryDto,
  DecorationStatusDto,
  NoticeFormDto,
} from "../dto/decoration.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("20.页面装修")
@Controller("decoration")
export class DecorationAdminController {
  constructor(private readonly service: DecorationService) {}

  @Get("banners/page")
  @Permissions("biz:decoration:banner:list")
  bannerPage(@Query() query: DecorationQueryDto) {
    return this.service.bannerPage(query);
  }

  @Get("banners/:id/form")
  @Permissions("biz:decoration:banner:list")
  bannerForm(@Param("id") id: string) {
    return this.service.bannerForm(id);
  }

  @Post("banners")
  @Permissions("biz:decoration:banner:create")
  createBanner(@Body() dto: BannerFormDto) {
    return this.service.createBanner(dto);
  }

  @Put("banners/:id")
  @Permissions("biz:decoration:banner:update")
  updateBanner(@Param("id") id: string, @Body() dto: BannerFormDto) {
    return this.service.updateBanner(id, dto);
  }

  @Patch("banners/:id/status")
  @Permissions("biz:decoration:banner:update")
  updateBannerStatus(@Param("id") id: string, @Body() dto: DecorationStatusDto) {
    return this.service.updateBannerStatus(id, dto.status);
  }

  @Delete("banners/:id")
  @Permissions("biz:decoration:banner:delete")
  removeBanner(@Param("id") id: string) {
    return this.service.removeBanner(id);
  }

  @Get("notices/page")
  @Permissions("biz:decoration:notice:list")
  noticePage(@Query() query: DecorationQueryDto) {
    return this.service.noticePage(query);
  }

  @Get("notices/:id/form")
  @Permissions("biz:decoration:notice:list")
  noticeForm(@Param("id") id: string) {
    return this.service.noticeForm(id);
  }

  @Post("notices")
  @Permissions("biz:decoration:notice:create")
  createNotice(@Body() dto: NoticeFormDto) {
    return this.service.createNotice(dto);
  }

  @Put("notices/:id")
  @Permissions("biz:decoration:notice:update")
  updateNotice(@Param("id") id: string, @Body() dto: NoticeFormDto) {
    return this.service.updateNotice(id, dto);
  }

  @Patch("notices/:id/status")
  @Permissions("biz:decoration:notice:update")
  updateNoticeStatus(@Param("id") id: string, @Body() dto: DecorationStatusDto) {
    return this.service.updateNoticeStatus(id, dto.status);
  }

  @Delete("notices/:id")
  @Permissions("biz:decoration:notice:delete")
  removeNotice(@Param("id") id: string) {
    return this.service.removeNotice(id);
  }

  @ApiOperation({ summary: "品牌背书" })
  @Get("brand")
  @Permissions("biz:decoration:brand:list")
  brand() {
    return this.service.getBrand();
  }

  @Put("brand")
  @Permissions("biz:decoration:brand:update")
  saveBrand(@Body() dto: BrandFormDto) {
    return this.service.saveBrand(dto.content);
  }
}
