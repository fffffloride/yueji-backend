import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { GroupBuyService } from "../group-buy.service";
import {
  GroupBuyActivityFormDto,
  GroupBuyActivityQueryDto,
  GroupBuyGroupQueryDto,
  GroupBuyStatusDto,
} from "../dto/group-buy.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("21.拼团管理")
@Controller("group-buy")
export class GroupBuyAdminController {
  constructor(private readonly service: GroupBuyService) {}

  @Get("activities/page")
  @Permissions("biz:group-buy:activity:list")
  activityPage(@Query() query: GroupBuyActivityQueryDto) {
    return this.service.activityPage(query);
  }

  @Get("activities/:id/form")
  @Permissions("biz:group-buy:activity:list")
  activityForm(@Param("id") id: string) {
    return this.service.activityForm(id);
  }

  @Post("activities")
  @Permissions("biz:group-buy:activity:create")
  createActivity(@Body() dto: GroupBuyActivityFormDto) {
    return this.service.createActivity(dto);
  }

  @Put("activities/:id")
  @Permissions("biz:group-buy:activity:update")
  updateActivity(@Param("id") id: string, @Body() dto: GroupBuyActivityFormDto) {
    return this.service.updateActivity(id, dto);
  }

  @Patch("activities/:id/status")
  @Permissions("biz:group-buy:activity:update")
  updateStatus(@Param("id") id: string, @Body() dto: GroupBuyStatusDto) {
    return this.service.updateActivityStatus(id, dto.status);
  }

  @Delete("activities/:id")
  @Permissions("biz:group-buy:activity:delete")
  removeActivity(@Param("id") id: string) {
    return this.service.removeActivity(id);
  }

  @Get("groups/page")
  @Permissions("biz:group-buy:group:list")
  groupPage(@Query() query: GroupBuyGroupQueryDto) {
    return this.service.groupPage(query);
  }

  @Get("groups/:id")
  @Permissions("biz:group-buy:group:list")
  groupDetail(@Param("id") id: string) {
    return this.service.groupDetail(id, true);
  }
}
