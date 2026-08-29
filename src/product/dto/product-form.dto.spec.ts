import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ProductFormDto } from "./product-form.dto";

const base = {
  name: "商品",
  categoryId: "1",
  mainImage: "http://localhost:9000/public/a.png",
  album: ["http://localhost:9000/public/b.png"],
  originalPrice: 100,
  detail: "<p>详情</p>",
  skus: [{ name: "默认", price: 80, stock: 1 }],
};

const errorsOf = (overrides: Record<string, unknown>) =>
  validate(plainToInstance(ProductFormDto, { ...base, ...overrides }));

describe("ProductFormDto", () => {
  it("完整表单通过", async () => {
    expect(await errorsOf({})).toHaveLength(0);
  });

  it("拒绝缺少主图、轮播图、划线原价、SKU和空详情", async () => {
    const [missingImage, missingAlbum, missingPrice, emptyDetail, emptySkus] = await Promise.all([
      errorsOf({ mainImage: "" }),
      errorsOf({ album: [] }),
      errorsOf({ originalPrice: undefined }),
      errorsOf({ detail: "<p><br></p>" }),
      errorsOf({ skus: [] }),
    ]);

    expect(missingImage.some((error) => error.property === "mainImage")).toBe(true);
    expect(missingAlbum.some((error) => error.property === "album")).toBe(true);
    expect(missingPrice.some((error) => error.property === "originalPrice")).toBe(true);
    expect(emptyDetail.some((error) => error.property === "detail")).toBe(true);
    expect(emptySkus.some((error) => error.property === "skus")).toBe(true);
  });
});
