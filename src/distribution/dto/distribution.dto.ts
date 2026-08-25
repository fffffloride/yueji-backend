import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { BaseQueryDto } from "@/common/dto/base-query.dto";

export class DistributionConfigQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

export class AgentTypeFormDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiProperty({ enum: [0, 1], default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort: number;
}

export class DistributionLevelFormDto extends AgentTypeFormDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rank: number;

  @ApiProperty({ description: "直属业绩升级门槛，单位分" })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  upgradeSalesAmount: number;

  @ApiProperty({ enum: [1, 2] })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  distributionDepth: number;

  @ApiProperty({ minimum: 0, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  level1RateBps: number;

  @ApiProperty({ minimum: 0, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  level2RateBps: number;
}

export class DistributionStatusDto {
  @ApiProperty({ enum: [0, 1] })
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status: number;
}

export class AgentQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false, enum: [0, 1, 2, 3] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2, 3])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  typeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  levelId?: string;
}

export class AgentFormDto {
  @ApiProperty()
  @IsString()
  memberId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  realName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  wechat?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactRemark?: string;

  @ApiProperty()
  @IsString()
  typeId: string;

  @ApiProperty()
  @IsString()
  levelId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentAgentId?: string;
}

export class AgentApplicationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  realName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  wechat?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactRemark?: string;

  @ApiProperty()
  @IsString()
  typeId: string;
}

export class AgentAuditDto {
  @ApiProperty({ enum: [1, 2] })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  typeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  levelId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentAgentId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  reason: string;
}

export class AgentAccountStatusDto {
  @ApiProperty({ enum: [1, 3] })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 3])
  status: number;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  reason: string;
}

export class AgentLevelAdjustDto {
  @ApiProperty()
  @IsString()
  levelId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  reason: string;
}

export class AgentRateAdjustDto {
  @ApiProperty({ required: false, nullable: true, minimum: 0, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  customLevel1RateBps?: number | null;

  @ApiProperty({ required: false, nullable: true, minimum: 0, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  customLevel2RateBps?: number | null;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  reason: string;
}

export class ReferralBindDto {
  @ApiProperty()
  @IsString()
  @MaxLength(16)
  inviteCode: string;
}

export class CommissionQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiProperty({ required: false, enum: [1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  depth?: number;

  @ApiProperty({ required: false, enum: [0, 1, 2, 3] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2, 3])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class SettlementConfigDto {
  @ApiProperty({ enum: ["WEEK", "MONTH", "QUARTER", "YEAR"] })
  @IsString()
  @IsIn(["WEEK", "MONTH", "QUARTER", "YEAR"])
  cycleType: string;

  @ApiProperty({ minimum: 1, maximum: 28 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  settlementDay: number;

  @ApiProperty({ enum: ["APPLY", "AUTO"] })
  @IsString()
  @IsIn(["APPLY", "AUTO"])
  withdrawalMode: string;

  @ApiProperty({ description: "单笔提现上限，单位分", minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  singleLimitAmount: number;
}

export class SettlementQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiProperty({ required: false, enum: ["PRODUCT_SALES"] })
  @IsOptional()
  @IsString()
  @IsIn(["PRODUCT_SALES"])
  profitPoint?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class WithdrawalQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiProperty({ required: false, enum: ["APPLY", "AUTO"] })
  @IsOptional()
  @IsString()
  @IsIn(["APPLY", "AUTO"])
  sourceMode?: string;

  @ApiProperty({ required: false, enum: [0, 1, 2, 3] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2, 3])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class WithdrawalApplyDto {
  @ApiProperty({ description: "提现金额，单位分", minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}

export class WithdrawalAuditDto {
  @ApiProperty({ enum: [1, 2], description: "1-审核通过 2-驳回" })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

export class WithdrawalPaidDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  transferNo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class DistributionTaskFormDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: ["SALES_AMOUNT", "ORDER_COUNT"] })
  @IsString()
  @IsIn(["SALES_AMOUNT", "ORDER_COUNT"])
  metricType: string;

  @ApiProperty({ minimum: 1, description: "销售额单位分；订单数单位单" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  targetValue: number;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty()
  @IsDateString()
  endTime: string;

  @ApiProperty({ enum: ["ALL", "LEVEL", "AGENT"] })
  @IsString()
  @IsIn(["ALL", "LEVEL", "AGENT"])
  assignmentScope: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetLevelId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  targetAgentIds?: string[];
}

export class DistributionTaskQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false, enum: [0, 1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  status?: number;

  @ApiProperty({
    required: false,
    enum: ["DRAFT", "NOT_STARTED", "IN_PROGRESS", "FINISHED", "CANCELLED"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["DRAFT", "NOT_STARTED", "IN_PROGRESS", "FINISHED", "CANCELLED"])
  displayStatus?: string;

  @ApiProperty({ required: false, enum: ["SALES_AMOUNT", "ORDER_COUNT"] })
  @IsOptional()
  @IsString()
  @IsIn(["SALES_AMOUNT", "ORDER_COUNT"])
  metricType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class DistributionTaskAssigneeQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false, enum: [0, 1], description: "0-未完成 1-已完成" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  completed?: number;
}

export class DistributionAppTaskQueryDto extends BaseQueryDto {
  @ApiProperty({
    required: false,
    enum: ["NOT_STARTED", "IN_PROGRESS", "FINISHED", "CANCELLED"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["NOT_STARTED", "IN_PROGRESS", "FINISHED", "CANCELLED"])
  displayStatus?: string;

  @ApiProperty({ required: false, enum: ["SALES_AMOUNT", "ORDER_COUNT"] })
  @IsOptional()
  @IsString()
  @IsIn(["SALES_AMOUNT", "ORDER_COUNT"])
  metricType?: string;

  @ApiProperty({ required: false, enum: [0, 1], description: "0-未完成 1-已完成" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  completed?: number;
}

export class DistributionAnalyticsQueryDto {
  @ApiProperty({ required: false, example: "2026-08-01" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ required: false, example: "2026-08-31" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}

export class DistributionAgentAnalyticsQueryDto extends BaseQueryDto {
  @ApiProperty({ required: false, example: "2026-08-01" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ required: false, example: "2026-08-31" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  levelId?: string;
}
