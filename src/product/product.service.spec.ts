import type { EntityManager } from "typeorm";

import { Product } from "./entities/product.entity";
import { ProductSku } from "./entities/product-sku.entity";
import { ProductService } from "./product.service";
import type { ProductFormDto } from "./dto/product-form.dto";

const createService = () =>
  new ProductService({} as never, {} as never, {} as never, {} as never, {} as never);

describe("ProductService", () => {
  it("拒绝没有启用SKU的上架商品", async () => {
    const dto = {
      name: "商品",
      categoryId: "1",
      status: 1,
      skus: [{ name: "停用规格", price: 100, stock: 1, status: 0 }],
    } as ProductFormDto;

    await expect(createService().create(dto)).rejects.toMatchObject({
      response: { msg: "上架商品至少需要一个启用的SKU" },
    });
  });

  it("回补已删除SKU后按当前可售SKU重算商品库存", async () => {
    const sku = { id: "10", productId: "1", stock: 2, status: 0, isDeleted: 1 };
    const product = { id: "1", stock: 9 };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(sku).mockResolvedValueOnce(product),
      save: jest.fn(async (entity) => entity),
      sum: jest.fn().mockResolvedValue(0),
    } as unknown as EntityManager;

    await createService().adjustStock(manager, "10", 3);

    expect(sku.stock).toBe(5);
    expect(product.stock).toBe(0);
    expect(manager.sum).toHaveBeenCalledWith(ProductSku, "stock", {
      productId: "1",
      status: 1,
      isDeleted: 0,
    });
    expect(manager.findOne).toHaveBeenNthCalledWith(2, Product, {
      where: { id: "1" },
      lock: { mode: "pessimistic_write" },
    });
  });

  it("阻止删除未完成订单引用的SKU", async () => {
    const query = {
      innerJoin: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getCount: jest.fn().mockResolvedValue(1),
    };
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.andWhere.mockReturnValue(query);
    const manager = { createQueryBuilder: jest.fn(() => query) } as unknown as EntityManager;

    await expect(
      (createService() as any).ensureNoActiveOrderReferences(manager, { skuIds: ["10"] })
    ).rejects.toMatchObject({
      response: { msg: "商品或SKU仍被未完成订单使用，不能删除" },
    });
    expect(query.andWhere).toHaveBeenCalledWith("orders.status IN (:...statuses)", {
      statuses: [0, 1, 2],
    });
  });
});
