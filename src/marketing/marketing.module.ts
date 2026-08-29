import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Coupon } from "./entities/coupon.entity";
import { CouponScope } from "./entities/coupon-scope.entity";
import { MemberCoupon } from "./entities/member-coupon.entity";
import { MemberLevel } from "./entities/member-level.entity";
import { MemberPointsLog } from "./entities/member-points-log.entity";
import { MarketingPointsRule } from "./entities/points-rule.entity";
import { MemberLevelService } from "./member-level.service";
import { PointsService } from "./points.service";
import { CouponService } from "./coupon.service";
import { OrderBenefitsService } from "./order-benefits.service";
import { MemberLevelAdminController } from "./admin/member-level-admin.controller";
import { PointsAdminController } from "./admin/points-admin.controller";
import { CouponAdminController } from "./admin/coupon-admin.controller";
import { MarketingAppController } from "./app/marketing-app.controller";
import { Member } from "@/member/entities/member.entity";
import { ProductSku } from "@/product/entities/product-sku.entity";
import { ProductCategory } from "@/product/entities/product-category.entity";
import { Product } from "@/product/entities/product.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Coupon,
      CouponScope,
      MemberCoupon,
      MemberLevel,
      MemberPointsLog,
      MarketingPointsRule,
      Member,
      ProductSku,
      Product,
      ProductCategory,
    ]),
  ],
  controllers: [
    MemberLevelAdminController,
    PointsAdminController,
    CouponAdminController,
    MarketingAppController,
  ],
  providers: [MemberLevelService, PointsService, CouponService, OrderBenefitsService],
  exports: [OrderBenefitsService],
})
export class MarketingModule {}
