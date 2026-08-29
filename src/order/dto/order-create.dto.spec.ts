import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { OrderCreateDto } from "./order-create.dto";

it("保留并校验多 SKU 下单的 skuId", async () => {
  const dto = plainToInstance(OrderCreateDto, {
    items: [
      { skuId: 58, quantity: 1 },
      { skuId: "38", quantity: 1 },
    ],
  });

  expect(await validate(dto, { whitelist: true })).toHaveLength(0);
  expect(dto.items?.map((item) => item.skuId)).toEqual(["58", "38"]);
});

it("拒绝重复 SKU 和超过 100 条的立即购买明细", async () => {
  const duplicate = plainToInstance(OrderCreateDto, {
    items: [
      { skuId: "58", quantity: 1 },
      { skuId: 58, quantity: 2 },
    ],
  });
  const oversized = plainToInstance(OrderCreateDto, {
    items: Array.from({ length: 101 }, (_, index) => ({
      skuId: String(index + 1),
      quantity: 1,
    })),
  });

  expect(await validate(duplicate)).not.toHaveLength(0);
  expect(await validate(oversized)).not.toHaveLength(0);
});

it("拒绝重复购物车 ID", async () => {
  const dto = plainToInstance(OrderCreateDto, { cartIds: [1, "1"] });

  expect(await validate(dto)).not.toHaveLength(0);
});
