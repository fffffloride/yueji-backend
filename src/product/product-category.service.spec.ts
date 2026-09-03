import type { DataSource, EntityManager, Repository } from "typeorm";

import { ProductCategoryService } from "./product-category.service";
import { ProductCategory } from "./entities/product-category.entity";
import { Product } from "./entities/product.entity";

describe("ProductCategoryService", () => {
  const createService = (
    categoryRepository: Partial<Repository<ProductCategory>>,
    manager: Partial<EntityManager>
  ) => {
    const dataSource = {
      transaction: jest.fn(async (work: (entityManager: EntityManager) => unknown) =>
        work(manager as EntityManager)
      ),
    } as unknown as DataSource;
    return new ProductCategoryService(
      categoryRepository as Repository<ProductCategory>,
      dataSource
    );
  };

  it("创建子分类时在事务内锁定有效父分类", async () => {
    const parent = { id: "1", treePath: "0", level: 1, isDeleted: 0 } as ProductCategory;
    const manager = {
      findOne: jest.fn().mockResolvedValue(parent),
      getRepository: jest.fn().mockReturnValue({ maximum: jest.fn().mockResolvedValue(0) }),
      create: jest.fn((_entity, value) => ({ id: "2", ...value })),
      save: jest.fn(async (value) => value),
    };
    const service = createService({}, manager);

    await service.create({ name: "子分类", parentId: "1" });

    expect(manager.findOne).toHaveBeenCalledWith(ProductCategory, {
      where: { id: "1", isDeleted: 0 },
      lock: { mode: "pessimistic_read" },
    });
  });

  it("删除分类时锁行、检查引用并执行条件软删", async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: "1", isDeleted: 0 }),
      count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = createService({}, manager);

    await service.remove("1");

    expect(manager.findOne).toHaveBeenCalledWith(ProductCategory, {
      where: { id: "1", isDeleted: 0 },
      lock: { mode: "pessimistic_write" },
    });
    expect(manager.count).toHaveBeenNthCalledWith(1, ProductCategory, {
      where: { parentId: "1", isDeleted: 0 },
    });
    expect(manager.count).toHaveBeenNthCalledWith(2, Product, {
      where: { categoryId: "1", isDeleted: 0 },
    });
    expect(manager.update).toHaveBeenCalledWith(
      ProductCategory,
      { id: "1", isDeleted: 0 },
      { isDeleted: 1 }
    );
  });

  it("后代遍历遇到历史环数据时不会无限递归", async () => {
    const categoryRepository = {
      find: jest.fn().mockResolvedValue([
        { id: "1", parentId: "2", isDeleted: 0 },
        { id: "2", parentId: "1", isDeleted: 0 },
      ]),
    };
    const service = createService(categoryRepository, {});

    await expect(service.getSelfAndDescendantIds("1")).resolves.toEqual(["1", "2"]);
  });
});
