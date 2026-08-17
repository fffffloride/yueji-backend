import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class OrderVerifyDto {
  @ApiProperty({ description: "核销码" })
  @IsNotEmpty({ message: "核销码不能为空" })
  @IsString()
  @MaxLength(32)
  verifyCode: string;
}

export class OrderCancelDto {
  @ApiProperty({ description: "取消原因", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
