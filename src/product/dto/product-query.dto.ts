import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { BaseQueryDto } from "@/common/dto/base-query.dto";

const toOptionalInt = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === "" ? undefined : Number(value);

const toOptionalStr = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === "" ? undefined : String(value);

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
};

/**
 * 商品分页查询（B端）
 */
export class ProductQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "关键字(商品名称)", required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ description: "分类ID", required: false })
  @IsOptional()
  @Transform(toOptionalStr)
  categoryId?: string;

  @ApiProperty({ description: "状态(1-上架 0-下架)", required: false })
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  status?: number;
}

/**
 * 商品分页查询（C端）
 */
export class AppProductQueryDto extends BaseQueryDto {
  @ApiProperty({ description: "关键字(商品名称)", required: false })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiProperty({ description: "分类ID(含子分类)", required: false })
  @IsOptional()
  @Transform(toOptionalStr)
  categoryId?: string;

  @ApiProperty({ description: "标签(推荐/新品/热卖)", required: false })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiProperty({
    description: "排序方式(default-综合 sales-销量 priceAsc-价格升 priceDesc-价格降 new-新品)",
    required: false,
    default: "default",
  })
  @IsOptional()
  @IsString()
  @IsIn(["default", "sales", "priceAsc", "priceDesc", "new"])
  sortType?: string;
}

/**
 * 连续商品目录查询（C端）
 */
export class AppProductCatalogQueryDto {
  @ApiProperty({ description: "仅查看疼痛友好商品", required: false })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  painFriendly?: boolean;
}
