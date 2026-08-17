import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("cart")
export class Cart extends BaseEntity {
  @Column({ name: "member_id", type: "bigint", comment: "会员ID" })
  memberId: string;

  @Column({ name: "product_id", type: "bigint", comment: "商品ID" })
  productId: string;

  @Column({ name: "sku_id", type: "bigint", comment: "SKU ID" })
  skuId: string;

  @Column({ type: "int", default: 1, comment: "数量" })
  quantity: number;

  @Column({ type: "tinyint", default: 1, comment: "是否选中(1-选中 0-未选中)" })
  checked: number;
}
