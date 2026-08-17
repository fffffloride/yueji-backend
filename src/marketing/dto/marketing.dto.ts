import { Transform, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { CouponScopeType, CouponType } from "../marketing.constants";

export class MemberLevelSaveDto {
  @IsString()
  @MaxLength(64)
  name: string;

  @IsInt()
  @Min(0)
  thresholdAmount: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  discountRate: number;

  @IsInt()
  @Min(0)
  @Max(1)
  status: number;

  @IsInt()
  sort: number;
}

export class PointsRuleDto {
  @IsInt()
  @Min(0)
  earnPerYuan: number;

  @IsInt()
  @Min(1)
  redeemPointsPerYuan: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  maxDeductRate: number;
}

export class PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}

export class PointsLogQueryDto extends PageDto {
  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : undefined))
  memberId?: string;

  @IsOptional()
  @IsString()
  bizType?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class CouponSaveDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsEnum(CouponScopeType)
  scopeType: CouponScopeType;

  @IsInt()
  @Min(0)
  thresholdAmount: number;

  @IsInt()
  @Min(0)
  discountAmount: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  discountRate: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscountAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : null))
  exchangeSkuId?: string | null;

  @IsDateString()
  claimStart: string;

  @IsDateString()
  claimEnd: string;

  @IsDateString()
  validStart: string;

  @IsDateString()
  validEnd: string;

  @IsInt()
  @Min(1)
  totalQuantity: number;

  @IsInt()
  @Min(1)
  perMemberLimit: number;

  @IsInt()
  @Min(0)
  @Max(2)
  status: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }) => (Array.isArray(value) ? value.map(String) : value))
  scopeIds?: string[];
}

export class CouponQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class MemberCouponQueryDto extends PageDto {
  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : undefined))
  couponId?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : undefined))
  memberId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class CouponIssueDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Transform(({ value }) => (Array.isArray(value) ? value.map(String) : value))
  memberIds: string[];
}
