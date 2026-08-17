import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class PaymentCreateDto {
  @ApiProperty({ description: "订单ID" })
  @IsString()
  orderId: string;
}
