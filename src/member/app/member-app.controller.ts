import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { MemberService } from "../member.service";
import { MemberProfileDto } from "../dto/member-profile.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

/**
 * 会员中心接口（C端小程序）
 */
@ApiTags("C02.会员中心")
@MemberAuth()
@Controller("app/member")
export class MemberAppController {
  constructor(private readonly memberService: MemberService) {}

  @ApiOperation({ summary: "获取当前会员资料" })
  @Get("profile")
  async getProfile(@CurrentMember() member: CurrentMemberInfo) {
    return this.memberService.getById(member.memberId);
  }

  @ApiOperation({ summary: "修改当前会员资料" })
  @Put("profile")
  async updateProfile(@CurrentMember() member: CurrentMemberInfo, @Body() dto: MemberProfileDto) {
    return this.memberService.updateProfile(member.memberId, dto);
  }
}
