import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RefundDto {
  @ApiProperty({ description: "退款原因" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason: string;
}
