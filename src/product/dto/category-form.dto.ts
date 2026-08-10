import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Transform } from "class-transformer";

/**
 * 商品分类表单（B端新增/修改）
 */
export class CategoryFormDto {
  @ApiProperty({ description: "分类名称" })
  @IsNotEmpty({ message: "分类名称不能为空" })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiProperty({ description: "父分类ID(0为顶级)", default: "0" })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? "0" : String(value)
  )
  parentId?: string = "0";

  @ApiProperty({ description: "分类图标", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  icon?: string;

  @ApiProperty({ description: "显示顺序", required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ description: "状态(1-启用 0-禁用)", required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
