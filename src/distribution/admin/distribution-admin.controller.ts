import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { DistributionService } from "../distribution.service";
import {
  AgentAccountStatusDto,
  AgentAuditDto,
  AgentFormDto,
  AgentLevelAdjustDto,
  AgentQueryDto,
  AgentRateAdjustDto,
  AgentTypeFormDto,
  CommissionQueryDto,
  DistributionConfigQueryDto,
  DistributionLevelFormDto,
  DistributionStatusDto,
} from "../dto/distribution.dto";
import { Permissions } from "@/common/decorators/auth.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

@ApiTags("21.分销管理")
@Controller("distribution")
export class DistributionAdminController {
  constructor(private readonly service: DistributionService) {}

  @Get("agent-types/page")
  @Permissions("biz:distribution:type:list")
  typePage(@Query() query: DistributionConfigQueryDto) {
    return this.service.typePage(query);
  }

  @Get("agent-types/:id/form")
  @Permissions("biz:distribution:type:list")
  typeForm(@Param("id") id: string) {
    return this.service.typeForm(id);
  }

  @Post("agent-types")
  @Permissions("biz:distribution:type:create")
  createType(@Body() dto: AgentTypeFormDto) {
    return this.service.createType(dto);
  }

  @Put("agent-types/:id")
  @Permissions("biz:distribution:type:update")
  updateType(@Param("id") id: string, @Body() dto: AgentTypeFormDto) {
    return this.service.updateType(id, dto);
  }

  @Patch("agent-types/:id/status")
  @Permissions("biz:distribution:type:update")
  updateTypeStatus(@Param("id") id: string, @Body() dto: DistributionStatusDto) {
    return this.service.updateTypeStatus(id, dto.status);
  }

  @Delete("agent-types/:id")
  @Permissions("biz:distribution:type:delete")
  removeType(@Param("id") id: string) {
    return this.service.removeType(id);
  }

  @Get("levels/page")
  @Permissions("biz:distribution:level:list")
  levelPage(@Query() query: DistributionConfigQueryDto) {
    return this.service.levelPage(query);
  }

  @Get("levels/:id/form")
  @Permissions("biz:distribution:level:list")
  levelForm(@Param("id") id: string) {
    return this.service.levelForm(id);
  }

  @Post("levels")
  @Permissions("biz:distribution:level:create")
  createLevel(@Body() dto: DistributionLevelFormDto) {
    return this.service.createLevel(dto);
  }

  @Put("levels/:id")
  @Permissions("biz:distribution:level:update")
  updateLevel(@Param("id") id: string, @Body() dto: DistributionLevelFormDto) {
    return this.service.updateLevel(id, dto);
  }

  @Patch("levels/:id/status")
  @Permissions("biz:distribution:level:update")
  updateLevelStatus(@Param("id") id: string, @Body() dto: DistributionStatusDto) {
    return this.service.updateLevelStatus(id, dto.status);
  }

  @Delete("levels/:id")
  @Permissions("biz:distribution:level:delete")
  removeLevel(@Param("id") id: string) {
    return this.service.removeLevel(id);
  }

  @Get("agents/page")
  @Permissions("biz:distribution:agent:list")
  agentPage(@Query() query: AgentQueryDto) {
    return this.service.agentPage(query);
  }

  @Get("agents/:id")
  @Permissions("biz:distribution:agent:list")
  agentDetail(@Param("id") id: string) {
    return this.service.agentDetail(id);
  }

  @Post("agents")
  @Permissions("biz:distribution:agent:create")
  createAgent(@Body() dto: AgentFormDto, @CurrentUser("userId") operatorId: string) {
    return this.service.createAgent(dto, operatorId);
  }

  @Put("agents/:id")
  @Permissions("biz:distribution:agent:update")
  updateAgent(
    @Param("id") id: string,
    @Body() dto: AgentFormDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.service.updateAgent(id, dto, operatorId);
  }

  @Put("agents/:id/audit")
  @Permissions("biz:distribution:agent:audit")
  auditAgent(
    @Param("id") id: string,
    @Body() dto: AgentAuditDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.service.auditAgent(id, dto, operatorId);
  }

  @Put("agents/:id/status")
  @Permissions("biz:distribution:agent:update")
  updateAgentStatus(
    @Param("id") id: string,
    @Body() dto: AgentAccountStatusDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.service.updateAgentStatus(id, dto, operatorId);
  }

  @Put("agents/:id/level")
  @Permissions("biz:distribution:agent:update")
  adjustLevel(
    @Param("id") id: string,
    @Body() dto: AgentLevelAdjustDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.service.adjustAgentLevel(id, dto, operatorId);
  }

  @Put("agents/:id/rates")
  @Permissions("biz:distribution:agent:update")
  adjustRates(
    @Param("id") id: string,
    @Body() dto: AgentRateAdjustDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.service.adjustAgentRates(id, dto, operatorId);
  }

  @Get("agents/:id/logs")
  @Permissions("biz:distribution:agent:list")
  logs(@Param("id") id: string, @Query() query: BaseQueryDto) {
    return this.service.agentLogs(id, query.pageNum, query.pageSize);
  }

  @Get("team/tree")
  @Permissions("biz:distribution:team:list")
  teamTree(@Query("rootAgentId") rootAgentId?: string) {
    return this.service.teamTree(rootAgentId);
  }

  @Get("commissions/page")
  @Permissions("biz:distribution:commission:list")
  commissions(@Query() query: CommissionQueryDto) {
    return this.service.commissionPage(query);
  }
}
