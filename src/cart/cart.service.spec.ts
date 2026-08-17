import { CartService } from "./cart.service";

describe("CartService", () => {
  const cartRepository = {} as any;
  const productRepository = {} as any;
  const skuRepository = {} as any;
  const productService = {
    getSkuForOrder: jest.fn(),
  };
  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
  };
  const service = new CartService(
    cartRepository,
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
    manager.findOne.mockResolvedValue({
      id: "30",
      memberId: "1",
      productId: "20",
      skuId: "10",
      quantity: 2,
      checked: 0,
      isDeleted: 0,
    });
    manager.save.mockImplementation(async (value) => value);

    const result = await service.add("1", { skuId: "10", quantity: 3 });

    expect(productService.getSkuForOrder).toHaveBeenCalledWith(manager, "10");
    expect(manager.findOne).toHaveBeenCalledWith(
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

  it("删除购物车项时附带会员归属条件", async () => {
    await service.removeOwnedByIds(manager as any, "7", ["1", "2"]);

    expect(manager.delete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ memberId: "7" })
    );
  });
});
