import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ProductCategoryService } from "../product-category.service";
import { CategoryFormDto } from "../dto/category-form.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

/**
 * 商品分类管理接口（B端）
 */
@ApiTags("14.商品分类管理")
@Controller("product-categories")
export class ProductCategoryAdminController {
  constructor(private readonly categoryService: ProductCategoryService) {}

  @ApiOperation({ summary: "分类树" })
  @Permissions("biz:product-category:list")
  @Get("tree")
  async tree() {
    return this.categoryService.tree(false);
  }

  @ApiOperation({ summary: "新增分类" })
  @Permissions("biz:product-category:create")
  @Post()
  async create(@Body() dto: CategoryFormDto) {
    return this.categoryService.create(dto);
  }

  @ApiOperation({ summary: "修改分类" })
  @Permissions("biz:product-category:update")
  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: CategoryFormDto) {
    return this.categoryService.update(id, dto);
  }

  @ApiOperation({ summary: "删除分类" })
  @Permissions("biz:product-category:delete")
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.categoryService.remove(id);
  }
}
