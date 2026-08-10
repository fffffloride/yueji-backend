import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { MemberService } from "../member.service";
import { MemberQueryDto } from "../dto/member-query.dto";

/**
 * 会员管理接口（B端）
 */
@ApiTags("13.会员管理")
@Controller("members")
export class MemberAdminController {
  constructor(private readonly memberService: MemberService) {}

  @ApiOperation({ summary: "会员分页列表" })
  @Get("page")
  async page(@Query() query: MemberQueryDto) {
    return this.memberService.pageQuery(query);
  }

  @ApiOperation({ summary: "会员详情" })
  @Get(":id")
  async detail(@Param("id") id: string) {
    return this.memberService.getById(id);
  }
}
