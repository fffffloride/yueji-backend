import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("product_sku")
export class ProductSku extends BaseEntity {
  @Column({ name: "product_id", type: "bigint", comment: "商品ID" })
  productId: string;

  @Column({ length: 100, comment: "规格名称(如：面部/2ml)" })
  name: string;

  @Column({ length: 255, nullable: true, comment: '规格属性(JSON：{"部位":"面部"})' })
  specs?: string | null;

  @Column({ name: "sku_code", length: 64, nullable: true, comment: "SKU编码" })
  skuCode?: string | null;

  @Column({ type: "int", default: 0, comment: "售价(分)" })
  price: number;

  @Column({ name: "original_price", type: "int", nullable: true, comment: "原价(分)" })
  originalPrice?: number | null;

  @Column({ type: "int", default: 0, comment: "库存" })
  stock: number;

  @Column({ type: "tinyint", default: 1, comment: "状态(1-启用 0-禁用)" })
  status: number;
}
