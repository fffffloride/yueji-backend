import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { OrderVerifyDto } from "./order-verify.dto";

describe("OrderVerifyDto", () => {
  it("只接受 8 位数字核销码", async () => {
    const valid = plainToInstance(OrderVerifyDto, { verifyCode: "01234567" });
    const invalid = plainToInstance(OrderVerifyDto, { verifyCode: "V12345678" });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
