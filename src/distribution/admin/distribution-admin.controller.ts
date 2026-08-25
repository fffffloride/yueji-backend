import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  SetMetadata,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response as ExpressResponse } from "express";
import * as XLSX from "xlsx";

import { DistributionAnalyticsService } from "../distribution-analytics.service";
import { DistributionService } from "../distribution.service";
import { DistributionSettlementService } from "../distribution-settlement.service";
import { DistributionTaskService } from "../distribution-task.service";
import {
  AgentAccountStatusDto,
  AgentAuditDto,
  AgentFormDto,
  AgentLevelAdjustDto,
  AgentQueryDto,
  AgentRateAdjustDto,
  AgentTypeFormDto,
  CommissionQueryDto,
  DistributionAgentAnalyticsQueryDto,
  DistributionAnalyticsQueryDto,
  DistributionConfigQueryDto,
  DistributionLevelFormDto,
  DistributionStatusDto,
  DistributionTaskAssigneeQueryDto,
  DistributionTaskFormDto,
  DistributionTaskQueryDto,
  SettlementConfigDto,
  SettlementQueryDto,
  WithdrawalAuditDto,
  WithdrawalPaidDto,
  WithdrawalQueryDto,
} from "../dto/distribution.dto";
import { Permissions } from "@/common/decorators/auth.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

@ApiTags("21.分销管理")
@Controller("distribution")
export class DistributionAdminController {
  constructor(
    private readonly service: DistributionService,
    private readonly analyticsService: DistributionAnalyticsService,
    private readonly settlementService: DistributionSettlementService,
    private readonly taskService: DistributionTaskService
  ) {}

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

  @Get("settlement/config")
  @Permissions("biz:distribution:settlement:list")
  settlementConfig() {
    return this.settlementService.getConfig();
  }

  @Put("settlement/config")
  @Permissions("biz:distribution:settlement:config")
  updateSettlementConfig(
    @Body() dto: SettlementConfigDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.settlementService.updateConfig(dto, operatorId);
  }

  @Post("settlements/run-due")
  @Permissions("biz:distribution:settlement:run")
  runDueSettlement() {
    return this.settlementService.runDue();
  }

  @Get("settlements/page")
  @Permissions("biz:distribution:settlement:list")
  settlements(@Query() query: SettlementQueryDto) {
    return this.settlementService.settlementPage(query);
  }

  @Get("withdrawals/page")
  @Permissions("biz:distribution:withdrawal:list")
  withdrawals(@Query() query: WithdrawalQueryDto) {
    return this.settlementService.withdrawalPage(query);
  }

  @Put("withdrawals/:id/audit")
  @Permissions("biz:distribution:withdrawal:audit")
  auditWithdrawal(
    @Param("id") id: string,
    @Body() dto: WithdrawalAuditDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.settlementService.auditWithdrawal(id, dto.status, dto.reason, operatorId);
  }

  @Put("withdrawals/:id/paid")
  @Permissions("biz:distribution:withdrawal:paid")
  paidWithdrawal(
    @Param("id") id: string,
    @Body() dto: WithdrawalPaidDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.settlementService.markWithdrawalPaid(id, dto.transferNo, dto.remark, operatorId);
  }

  @Get("analytics/overview")
  @Permissions("biz:distribution:analytics:list")
  analyticsOverview(@Query() query: DistributionAnalyticsQueryDto) {
    return this.analyticsService.overview(query);
  }

  @Get("analytics/agents/page")
  @Permissions("biz:distribution:analytics:list")
  analyticsAgents(@Query() query: DistributionAgentAnalyticsQueryDto) {
    return this.analyticsService.agentPage(query);
  }

  @Get("analytics/agents/:agentId")
  @Permissions("biz:distribution:analytics:list")
  analyticsAgent(@Param("agentId") agentId: string, @Query() query: DistributionAnalyticsQueryDto) {
    return this.analyticsService.agentDetail(agentId, query);
  }

  @Get("analytics/export")
  @Permissions("biz:distribution:analytics:export")
  @SetMetadata("skipResponseTransform", true)
  @ApiOperation({ summary: "导出销售统计" })
  async exportAnalytics(
    @Query() query: DistributionAnalyticsQueryDto,
    @Res() res: ExpressResponse
  ) {
    const { range, overview, agents } = await this.analyticsService.exportReport(query);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["统计周期", "全系统销售额(元)", "已核销订单数", "分销直属销售额(元)"],
        ...overview.trend.map((row) => [
          row.period,
          row.totalSalesAmount / 100,
          row.verifiedOrderCount,
          row.distributionSalesAmount / 100,
        ]),
      ]),
      "销售趋势"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          "排名",
          "代理ID",
          "姓名",
          "手机号",
          "当前等级",
          "账号状态",
          "直属销售额(元)",
          "订单数",
          "客户数",
        ],
        ...agents.map((row, index) => [
          index + 1,
          row.agentId,
          row.realName,
          row.mobile,
          row.levelName,
          row.status === 1 ? "已审核" : "已禁用",
          row.salesAmount / 100,
          row.orderCount,
          row.customerCount,
        ]),
      ]),
      "代理业绩"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["等级", "已审核人数", "已禁用人数", "总人数", "直属销售额(元)", "订单数", "客户数"],
        ...overview.levels.map((row) => [
          row.levelName,
          row.approvedAgentCount,
          row.disabledAgentCount,
          row.agentCount,
          row.salesAmount / 100,
          row.orderCount,
          row.customerCount,
        ]),
      ]),
      "层级统计"
    );
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const fileName = `销售统计_${range.startDate}_${range.endDate}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(fileName)}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  }

  @Get("tasks/page")
  @Permissions("biz:distribution:task:list")
  taskPage(@Query() query: DistributionTaskQueryDto) {
    return this.taskService.taskPage(query);
  }

  @Get("tasks/:id")
  @Permissions("biz:distribution:task:list")
  taskDetail(@Param("id") id: string) {
    return this.taskService.taskDetail(id);
  }

  @Post("tasks")
  @Permissions("biz:distribution:task:create")
  createTask(@Body() dto: DistributionTaskFormDto, @CurrentUser("userId") operatorId: string) {
    return this.taskService.createTask(dto, operatorId);
  }

  @Put("tasks/:id")
  @Permissions("biz:distribution:task:update")
  updateTask(
    @Param("id") id: string,
    @Body() dto: DistributionTaskFormDto,
    @CurrentUser("userId") operatorId: string
  ) {
    return this.taskService.updateTask(id, dto, operatorId);
  }

  @Delete("tasks/:id")
  @Permissions("biz:distribution:task:delete")
  removeTask(@Param("id") id: string, @CurrentUser("userId") operatorId: string) {
    return this.taskService.removeTask(id, operatorId);
  }

  @Post("tasks/:id/publish")
  @Permissions("biz:distribution:task:publish")
  publishTask(@Param("id") id: string, @CurrentUser("userId") operatorId: string) {
    return this.taskService.publishTask(id, operatorId);
  }

  @Post("tasks/:id/cancel")
  @Permissions("biz:distribution:task:cancel")
  cancelTask(@Param("id") id: string, @CurrentUser("userId") operatorId: string) {
    return this.taskService.cancelTask(id, operatorId);
  }

  @Get("tasks/:id/assignees/page")
  @Permissions("biz:distribution:task:list")
  taskAssignees(@Param("id") id: string, @Query() query: DistributionTaskAssigneeQueryDto) {
    return this.taskService.assigneePage(id, query);
  }
}
