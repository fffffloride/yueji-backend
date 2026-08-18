import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Product } from "./entities/product.entity";
import { ProductSku } from "./entities/product-sku.entity";
import { ProductCategory } from "./entities/product-category.entity";
import { ProductService } from "./product.service";
import { ProductCategoryService } from "./product-category.service";
import { ProductAdminController } from "./admin/product-admin.controller";
import { ProductCategoryAdminController } from "./admin/product-category-admin.controller";
import { ProductAppController } from "./app/product-app.controller";
import { BizOrder } from "@/order/entities/order.entity";
import { BizOrderItem } from "@/order/entities/order-item.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductSku, ProductCategory, BizOrder, BizOrderItem]),
  ],
  controllers: [ProductCategoryAdminController, ProductAdminController, ProductAppController],
  providers: [ProductService, ProductCategoryService],
  exports: [ProductService, ProductCategoryService],
})
export class ProductModule {}
