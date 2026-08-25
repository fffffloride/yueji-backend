import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { DistributionService } from "../distribution.service";
import { DistributionSettlementService } from "../distribution-settlement.service";
import {
  AgentApplicationDto,
  CommissionQueryDto,
  ReferralBindDto,
  WithdrawalApplyDto,
  WithdrawalQueryDto,
} from "../dto/distribution.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C09.分销中心")
@MemberAuth()
@Controller("app/distribution")
export class DistributionAppController {
  constructor(
    private readonly service: DistributionService,
    private readonly settlementService: DistributionSettlementService
  ) {}

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

  @Get("settlement/account")
  settlementAccount(@CurrentMember() member: CurrentMemberInfo) {
    return this.settlementService.accountForMember(member.memberId);
  }

  @Post("withdrawals")
  applyWithdrawal(@CurrentMember() member: CurrentMemberInfo, @Body() dto: WithdrawalApplyDto) {
    return this.settlementService.applyWithdrawal(member.memberId, dto.amount);
  }

  @Get("withdrawals/page")
  withdrawals(@CurrentMember() member: CurrentMemberInfo, @Query() query: WithdrawalQueryDto) {
    return this.settlementService.withdrawalPage(query, member.memberId);
  }
}
