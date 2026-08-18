import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

import { ProductService } from "../product.service";
import { ProductFormDto } from "../dto/product-form.dto";
import { ProductQueryDto } from "../dto/product-query.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

class ProductStatusDto {
  @ApiProperty({ description: "状态(1-上架 0-下架)" })
  @IsInt()
  @IsIn([0, 1])
  status: number;
}

/**
 * 商品管理接口（B端）
 */
@ApiTags("15.商品管理")
@Controller("products")
export class ProductAdminController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({ summary: "商品分页列表" })
  @Permissions("biz:product:list")
  @Get("page")
  async page(@Query() query: ProductQueryDto) {
    return this.productService.pageQuery(query);
  }

  @ApiOperation({ summary: "商品SKU选项" })
  @Permissions("biz:product:list")
  @Get("sku-options")
  async skuOptions() {
    return this.productService.skuOptions();
  }

  @ApiOperation({ summary: "商品表单数据(含SKU)" })
  @Permissions("biz:product:list")
  @Get(":id/form")
  async form(@Param("id") id: string) {
    return this.productService.getFormData(id);
  }

  @ApiOperation({ summary: "新增商品" })
  @Permissions("biz:product:create")
  @Post()
  async create(@Body() dto: ProductFormDto) {
    return this.productService.create(dto);
  }

  @ApiOperation({ summary: "修改商品" })
  @Permissions("biz:product:update")
  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: ProductFormDto) {
    return this.productService.update(id, dto);
  }

  @ApiOperation({ summary: "商品上下架" })
  @Permissions("biz:product:status")
  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Body() dto: ProductStatusDto) {
    await this.productService.updateStatus(id, dto.status);
  }

  @ApiOperation({ summary: "删除商品" })
  @Permissions("biz:product:delete")
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.productService.remove(id);
  }
}
