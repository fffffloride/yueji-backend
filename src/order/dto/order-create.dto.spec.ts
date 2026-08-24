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
