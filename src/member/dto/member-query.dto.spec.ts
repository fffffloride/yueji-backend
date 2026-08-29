import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { MemberQueryDto } from "./member-query.dto";

describe("MemberQueryDto", () => {
  it("限制深分页页码", async () => {
    const dto = plainToInstance(MemberQueryDto, { pageNum: "1001", pageSize: "10" });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "pageNum")).toBe(true);
  });

  it("拒绝非法会员状态", async () => {
    const dto = plainToInstance(MemberQueryDto, { status: "2" });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "status")).toBe(true);
  });

  it("接受边界内的分页和状态", async () => {
    const dto = plainToInstance(MemberQueryDto, {
      pageNum: "1000",
      pageSize: "100",
      status: "1",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
