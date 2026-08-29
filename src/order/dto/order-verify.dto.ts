import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class OrderVerifyDto {
  @ApiProperty({ description: "核销码" })
  @IsNotEmpty({ message: "核销码不能为空" })
  @IsString()
  @Matches(/^\d{8}$/, { message: "核销码必须为8位数字" })
  verifyCode: string;
}

export class OrderCancelDto {
  @ApiProperty({ description: "取消原因", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
