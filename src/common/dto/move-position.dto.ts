import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class MovePositionDto {
  @ApiProperty({ description: "目标位置，从 1 开始", minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position: number;

  @ApiPropertyOptional({ description: "树形资源当前父节点 ID" })
  @IsOptional()
  @IsString()
  parentId?: string;
}
