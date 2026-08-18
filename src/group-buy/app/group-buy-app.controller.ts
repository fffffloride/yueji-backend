import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { GroupBuyService } from "../group-buy.service";
import { GroupBuyActivityQueryDto, GroupBuyStartDto } from "../dto/group-buy.dto";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { Public } from "@/common/decorators/auth.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C09.拼团")
@Public()
@Controller("app/group-buy")
export class GroupBuyAppPublicController {
  constructor(private readonly service: GroupBuyService) {}

  @Get("activities")
  activities(@Query() query: GroupBuyActivityQueryDto) {
    return this.service.activityPage(query, true);
  }

  @Get("activities/:id")
  activity(@Param("id") id: string) {
    return this.service.appActivityDetail(id);
  }

  @Get("groups/:id")
  group(@Param("id") id: string) {
    return this.service.groupDetail(id);
  }
}

@ApiTags("C09.拼团")
@MemberAuth()
@Controller("app/group-buy")
export class GroupBuyAppMemberController {
  constructor(private readonly service: GroupBuyService) {}

  @Post("groups")
  start(@CurrentMember() member: CurrentMemberInfo, @Body() dto: GroupBuyStartDto) {
    return this.service.start(member.memberId, dto.activityId);
  }

  @Post("groups/:id/join")
  join(@CurrentMember() member: CurrentMemberInfo, @Param("id") id: string) {
    return this.service.join(member.memberId, id);
  }
}
