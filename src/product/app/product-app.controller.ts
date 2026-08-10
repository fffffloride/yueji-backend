import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ProductService } from "../product.service";
import { ProductCategoryService } from "../product-category.service";
import { AppProductQueryDto } from "../dto/product-query.dto";
import { Public } from "@/common/decorators/auth.decorator";

/**
 * 商品浏览接口（C端小程序，无需登录）
 */
@ApiTags("C03.商品浏览")
@Public()
@Controller("app/product")
export class ProductAppController {
  constructor(
    private readonly productService: ProductService,
    private readonly categoryService: ProductCategoryService
  ) {}

  @ApiOperation({ summary: "商品分类树(仅启用)" })
  @Get("categories")
  async categories() {
    return this.categoryService.tree(true);
  }

  @ApiOperation({ summary: "商品分页列表(支持分类/标签/关键字/排序)" })
  @Get("page")
  async page(@Query() query: AppProductQueryDto) {
    return this.productService.appPage(query);
  }

  @ApiOperation({ summary: "商品详情(含启用SKU)" })
  @Get(":id")
  async detail(@Param("id") id: string) {
    return this.productService.appDetail(id);
  }
}
