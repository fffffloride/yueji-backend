import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RefundDto {
  @ApiProperty({ description: "退款原因" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/\S/, { message: "退款原因不能为空" })
  reason: string;
}
