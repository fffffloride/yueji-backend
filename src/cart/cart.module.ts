import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Cart } from "./entities/cart.entity";
import { CartService } from "./cart.service";
import { CartAppController } from "./app/cart-app.controller";
import { ProductModule } from "@/product/product.module";
import { Product } from "@/product/entities/product.entity";
import { ProductSku } from "@/product/entities/product-sku.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Cart, Product, ProductSku]), ProductModule],
  controllers: [CartAppController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
