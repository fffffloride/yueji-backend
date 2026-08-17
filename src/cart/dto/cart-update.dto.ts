import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class CartUpdateDto {
  @ApiProperty({ description: "数量", required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @ApiProperty({ description: "是否选中(1-选中 0-未选中)", required: false })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  checked?: number;
}
