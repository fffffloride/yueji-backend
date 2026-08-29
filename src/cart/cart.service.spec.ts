import { CartService } from "./cart.service";

describe("CartService", () => {
  const cartRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const productRepository = {} as any;
  const skuRepository = {} as any;
  const productService = {
    getSkuForOrder: jest.fn(),
  };
  const manager = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
  };
  const service = new CartService(
    cartRepository as any,
    productRepository,
    skuRepository,
    productService as any,
    dataSource as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("加购时锁定 SKU 和购物车行后累加数量", async () => {
    productService.getSkuForOrder.mockResolvedValue({
      sku: { id: "10", stock: 9 },
      product: { id: "20" },
    });
    manager.find.mockResolvedValue([
      {
        id: "30",
        memberId: "1",
        productId: "20",
        skuId: "10",
        quantity: 2,
        checked: 0,
        isDeleted: 0,
      },
    ]);
    manager.save.mockImplementation(async (value) => value);

    const result = await service.add("1", { skuId: "10", quantity: 3 });

    expect(productService.getSkuForOrder).toHaveBeenCalledWith(manager, "10");
    expect(manager.find).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lock: { mode: "pessimistic_write" } })
    );
    expect(result).toMatchObject({ quantity: 5, checked: 1 });
  });

  it("任一购物车 ID 不属于当前会员时拒绝下单", async () => {
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: "1", memberId: "7" }]),
    };
    manager.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.findOwnedByIds(manager as any, "7", ["1", "2"]).then(
      () => {
        throw new Error("应拒绝包含其他会员购物车 ID 的请求");
      },
      (error) => {
        expect(error.getResponse()).toMatchObject({ msg: "购物车项不存在" });
      }
    );
  });

  it("锁定后的购物车数量与下单快照不一致时拒绝继续", async () => {
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: "1", memberId: "7", skuId: "10", quantity: 3 }]),
    };
    manager.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(
      service.lockOwnedByIds(manager as any, "7", ["1"], [{ skuId: "10", quantity: 2 }])
    ).rejects.toMatchObject({
      response: { msg: "购物车状态已变化，请重新确认" },
    });
  });

  it("删除购物车项时附带会员归属条件", async () => {
    manager.update.mockResolvedValue({ affected: 2 });

    await service.removeOwnedByIds(manager as any, "7", ["1", "2"]);

    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ memberId: "7", isDeleted: 0 }),
      { isDeleted: 1, checked: 0 }
    );
  });

  it("修改数量时按SKU到购物车的顺序加锁并重新校验库存", async () => {
    const row = {
      id: "30",
      memberId: "1",
      productId: "20",
      skuId: "10",
      quantity: 2,
      checked: 1,
      isDeleted: 0,
    };
    cartRepository.findOne.mockResolvedValue({ ...row });
    productService.getSkuForOrder.mockResolvedValue({
      sku: { id: "10", stock: 9 },
      product: { id: "20" },
    });
    manager.findOne.mockResolvedValue({ ...row });
    manager.save.mockImplementation(async (value) => value);

    const result = await service.update("1", "30", { quantity: 5 });

    expect(productService.getSkuForOrder).toHaveBeenCalledWith(manager, "10");
    expect(manager.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: { id: "30", memberId: "1", isDeleted: 0 },
        lock: { mode: "pessimistic_write" },
      })
    );
    expect(result).toMatchObject({ quantity: 5 });
  });

  it("失效项仍允许通过归属条件原子取消选中", async () => {
    cartRepository.findOne.mockResolvedValue({
      id: "30",
      memberId: "1",
      skuId: "10",
      checked: 1,
      isDeleted: 0,
    });
    cartRepository.update.mockResolvedValue({ affected: 1 });

    const result = await service.update("1", "30", { checked: 0 });

    expect(productService.getSkuForOrder).not.toHaveBeenCalled();
    expect(cartRepository.update).toHaveBeenCalledWith(
      { id: "30", memberId: "1", isDeleted: 0 },
      { checked: 0 }
    );
    expect(result).toMatchObject({ checked: 0 });
  });

  it("新增第101种有效规格时拒绝加购", async () => {
    productService.getSkuForOrder.mockResolvedValue({
      sku: { id: "999", stock: 9 },
      product: { id: "20" },
    });
    manager.find.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        id: String(index + 1),
        skuId: String(index + 1),
        isDeleted: 0,
      }))
    );

    await expect(service.add("1", { skuId: "999", quantity: 1 })).rejects.toMatchObject({
      response: { msg: "购物车最多保留100种商品规格" },
    });
  });
});
