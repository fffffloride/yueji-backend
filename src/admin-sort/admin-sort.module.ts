import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AdminSortController } from "./admin-sort.controller";
import { AdminSortService } from "./admin-sort.service";
import { DecorationBanner } from "@/decoration/entities/banner.entity";
import { DecorationNotice } from "@/decoration/entities/decoration-notice.entity";
import { DistributionAgentType } from "@/distribution/entities/agent-type.entity";
import { ProductCategory } from "@/product/entities/product-category.entity";
import { Product } from "@/product/entities/product.entity";
import { SysDept } from "@/system/dept/entities/sys-dept.entity";
import { SysDictItem } from "@/system/dict/entities/sys-dict-item.entity";
import { SysMenu } from "@/system/menu/entities/sys-menu.entity";
import { SysRole } from "@/system/role/entities/sys-role.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductCategory,
      DecorationBanner,
      DecorationNotice,
      DistributionAgentType,
      SysRole,
      SysDictItem,
      SysDept,
      SysMenu,
    ]),
  ],
  controllers: [AdminSortController],
  providers: [AdminSortService],
})
export class AdminSortModule {}
