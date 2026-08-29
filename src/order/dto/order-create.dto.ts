import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class OrderCreateItemDto {
  @ApiProperty({ description: "SKU ID" })
  @Transform(({ value }) => String(value))
  @IsString()
  skuId: string;

  @ApiProperty({ description: "数量" })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class OrderCreateDto {
  @ApiProperty({ description: "购物车ID列表(从购物车下单)", required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v)) : value))
  cartIds?: string[];

  @ApiProperty({ description: "立即购买明细", required: false, type: [OrderCreateItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique((item: OrderCreateItemDto | null | undefined) => String(item?.skuId ?? ""))
  @ValidateNested({ each: true })
  @Type(() => OrderCreateItemDto)
  items?: OrderCreateItemDto[];

  @ApiProperty({ description: "会员券ID", required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? String(value) : undefined))
  memberCouponId?: string;

  @ApiProperty({ description: "计划使用积分", required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pointsToUse?: number;

  @ApiProperty({ description: "联系人姓名", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactName?: string;

  @ApiProperty({ description: "联系人手机号", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactMobile?: string;

  @ApiProperty({ description: "订单备注", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
