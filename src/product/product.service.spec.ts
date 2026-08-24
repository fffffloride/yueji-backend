import type { EntityManager } from "typeorm";

import { Product } from "./entities/product.entity";
import { ProductSku } from "./entities/product-sku.entity";
import { ProductService } from "./product.service";
import type { ProductFormDto } from "./dto/product-form.dto";

const createService = (
  productRepository: Record<string, unknown> = {},
  categoryService: Record<string, unknown> = {}
) =>
  new ProductService(
    productRepository as never,
    {} as never,
    {} as never,
    categoryService as never,
    {} as never
  );

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

  it("按一级与二级分类构建疼痛友好商品目录", async () => {
    const productRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: "101",
          name: "一级直挂商品",
          categoryId: "1",
          tags: "推荐,热卖",
          price: 100,
          originalPrice: 120,
          sales: 3,
          painFriendly: true,
        },
        {
          id: "102",
          name: "三级分类商品",
          categoryId: "111",
          tags: "口碑",
          price: 200,
          originalPrice: null,
          sales: 2,
          painFriendly: true,
        },
      ]),
    };
    const categoryService = {
      tree: jest.fn().mockResolvedValue([
        {
          id: "1",
          name: "水光抗衰",
          children: [
            {
              id: "11",
              name: "胶原水光",
              children: [{ id: "111", name: "深层胶原" }],
            },
          ],
        },
        { id: "2", name: "空分类" },
      ]),
    };

    const result = await createService(productRepository, categoryService).appCatalog({
      painFriendly: true,
    });

    expect(productRepository.find).toHaveBeenCalledWith({
      where: { isDeleted: 0, status: 1, painFriendly: true },
      order: { sort: "ASC", sales: "DESC" },
    });
    expect(result).toEqual({
      groups: [
        {
          id: "1",
          name: "水光抗衰",
          sections: [
            {
              id: "1",
              name: "水光抗衰",
              total: 1,
              products: [expect.objectContaining({ id: "101", tags: ["推荐", "热卖"] })],
            },
            {
              id: "11",
              name: "胶原水光",
              total: 1,
              products: [expect.objectContaining({ id: "102", tags: ["口碑"] })],
            },
          ],
        },
      ],
    });
  });
});
