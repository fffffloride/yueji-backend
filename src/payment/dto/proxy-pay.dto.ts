import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class ProxyPayShareDto {
  @ApiProperty({ description: "订单ID" })
  @Transform(({ value }) => String(value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: "订单ID格式无效" })
  orderId: string;
}

export class ProxyPayTokenDto {
  @ApiProperty({ description: "好友代付分享令牌" })
  @IsString()
  @Length(22, 22)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "分享令牌格式无效" })
  token: string;
}
