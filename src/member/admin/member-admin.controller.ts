import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { MemberService } from "../member.service";
import { MemberQueryDto } from "../dto/member-query.dto";
import { MemberUpdateDto } from "../dto/member-update.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

/**
 * 会员管理接口（B端）
 */
@ApiTags("13.会员管理")
@Controller("members")
export class MemberAdminController {
  constructor(private readonly memberService: MemberService) {}

  @ApiOperation({ summary: "会员分页列表" })
  @Get("page")
  @Permissions("biz:member:list")
  async page(@Query() query: MemberQueryDto) {
    return this.memberService.pageQuery(query);
  }

  @ApiOperation({ summary: "会员360视图" })
  @Get(":id/360")
  @Permissions("biz:member:list")
  async overview(@Param("id") id: string) {
    return this.memberService.get360(id);
  }

  @ApiOperation({ summary: "会员详情" })
  @Get(":id")
  @Permissions("biz:member:list")
  async detail(@Param("id") id: string) {
    return this.memberService.getById(id);
  }

  @ApiOperation({ summary: "更新会员标签和备注" })
  @Put(":id")
  @Permissions("biz:member:update")
  async update(@Param("id") id: string, @Body() dto: MemberUpdateDto) {
    return this.memberService.updateByAdmin(id, dto);
  }
}
