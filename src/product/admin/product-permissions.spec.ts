import "reflect-metadata";

import { METADATA } from "@/common/constants/metadata.constant";
import { ProductAdminController } from "./product-admin.controller";
import { ProductCategoryAdminController } from "./product-category-admin.controller";

describe("商品管理权限", () => {
  it("为查询和写操作声明对应权限", () => {
    const cases = [
      [ProductAdminController, "page", "biz:product:list"],
      [ProductAdminController, "create", "biz:product:create"],
      [ProductAdminController, "update", "biz:product:update"],
      [ProductAdminController, "updateStatus", "biz:product:status"],
      [ProductAdminController, "remove", "biz:product:delete"],
      [ProductCategoryAdminController, "tree", "biz:product-category:list"],
      [ProductCategoryAdminController, "create", "biz:product-category:create"],
      [ProductCategoryAdminController, "update", "biz:product-category:update"],
      [ProductCategoryAdminController, "remove", "biz:product-category:delete"],
    ] as const;

    for (const [controller, method, permission] of cases) {
      expect(Reflect.getMetadata(METADATA.PERMISSIONS, controller.prototype[method])).toEqual([
        permission,
      ]);
    }
  });
});
