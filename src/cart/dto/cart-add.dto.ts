import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, Max, Min } from "class-validator";
import { Transform } from "class-transformer";

export class CartAddDto {
  @ApiProperty({ description: "SKU ID" })
  @IsNotEmpty({ message: "SKU不能为空" })
  @Transform(({ value }) => String(value))
  skuId: string;

  @ApiProperty({ description: "数量", default: 1 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number = 1;
}
