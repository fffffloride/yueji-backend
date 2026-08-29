import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";

function isBlankHtml(value: unknown): boolean {
  if (typeof value !== "string") return true;
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().length === 0;
}

/**
 * SKU 表单项
 */
export class SkuFormDto {
  @ApiProperty({ description: "SKU ID(修改时传，新增不传)", required: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : String(value)
  )
  id?: string;

  @ApiProperty({ description: "规格名称(如：面部/2ml)" })
  @IsNotEmpty({ message: "规格名称不能为空" })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: "规格属性JSON", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  specs?: string;

  @ApiProperty({ description: "SKU编码", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  skuCode?: string;

  @ApiProperty({ description: "售价(分)" })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ description: "原价(分)", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  originalPrice?: number;

  @ApiProperty({ description: "库存" })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ description: "状态(1-启用 0-禁用)", required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}

/**
 * 商品表单（B端新增/修改）
 */
export class ProductFormDto {
  @ApiProperty({ description: "商品名称" })
  @IsNotEmpty({ message: "商品名称不能为空" })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: "分类ID" })
  @IsNotEmpty({ message: "分类不能为空" })
  @Transform(({ value }) => String(value))
  categoryId: string;

  @ApiProperty({ description: "副标题", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subTitle?: string;

  @ApiProperty({ description: "主图URL" })
  @IsNotEmpty({ message: "请上传主图" })
  @IsString()
  @MaxLength(255)
  mainImage: string;

  @ApiProperty({ description: "轮播图URL列表", type: [String] })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : value
  )
  @IsArray()
  @ArrayNotEmpty({ message: "请至少上传一张轮播图" })
  @IsString({ each: true })
  album: string[];

  @ApiProperty({ description: "短视频URL", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  videoUrl?: string;

  @ApiProperty({ description: "标签(逗号分隔：推荐,新品,热卖)", required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tags?: string;

  @ApiProperty({ description: "是否疼痛友好", required: false, default: false })
  @IsOptional()
  @IsBoolean()
  painFriendly?: boolean;

  @ApiProperty({ description: "原价(分)" })
  @IsInt({ message: "请填写划线原价" })
  @Min(0)
  originalPrice: number;

  @ApiProperty({ description: "商品详情(富文本)" })
  @Transform(({ value }) => (isBlankHtml(value) ? "" : value))
  @IsNotEmpty({ message: "请填写商品详情" })
  @IsString()
  detail: string;

  @ApiProperty({ description: "产品说明", required: false })
  @IsOptional()
  @IsString()
  usageNote?: string;

  @ApiProperty({ description: "状态(1-上架 0-下架)", required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;

  @ApiProperty({ description: "显示顺序", required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ description: "SKU列表", type: [SkuFormDto] })
  @IsArray()
  @ArrayNotEmpty({ message: "至少需要一个SKU" })
  @ValidateNested({ each: true })
  @Type(() => SkuFormDto)
  skus: SkuFormDto[];
}
