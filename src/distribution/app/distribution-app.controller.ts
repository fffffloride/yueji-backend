import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { DistributionService } from "../distribution.service";
import { AgentApplicationDto, CommissionQueryDto, ReferralBindDto } from "../dto/distribution.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C09.分销中心")
@MemberAuth()
@Controller("app/distribution")
export class DistributionAppController {
  constructor(private readonly service: DistributionService) {}

  @Post("applications")
  apply(@CurrentMember() member: CurrentMemberInfo, @Body() dto: AgentApplicationDto) {
    return this.service.apply(member.memberId, dto);
  }

  @Get("profile")
  profile(@CurrentMember() member: CurrentMemberInfo) {
    return this.service.appProfile(member.memberId);
  }

  @Post("referrals/bind")
  bind(@CurrentMember() member: CurrentMemberInfo, @Body() dto: ReferralBindDto) {
    return this.service.bindReferral(member.memberId, dto.inviteCode);
  }

  @Get("commissions/page")
  commissions(@CurrentMember() member: CurrentMemberInfo, @Query() query: CommissionQueryDto) {
    return this.service.appCommissionPage(member.memberId, query);
  }

  @Get("team")
  team(@CurrentMember() member: CurrentMemberInfo) {
    return this.service.appTeam(member.memberId);
  }
}
