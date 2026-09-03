import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsString, Length, Matches } from "class-validator";

import { OrderGiftDirection, type OrderGiftDirectionValue } from "../order-gift-status";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

export class OrderGiftCreateDto {
  @ApiProperty({ description: "订单ID" })
  @Transform(({ value }) => String(value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: "订单ID格式无效" })
  orderId: string;
}

export class OrderGiftTokenDto {
  @ApiProperty({ description: "分享令牌" })
  @IsString()
  @Length(43, 43)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token: string;
}

export class OrderGiftPageQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "记录方向", enum: Object.values(OrderGiftDirection) })
  @IsIn(Object.values(OrderGiftDirection))
  direction: OrderGiftDirectionValue;
}
