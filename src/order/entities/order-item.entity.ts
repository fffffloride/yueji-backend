import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Index("idx_order_item_order", ["orderId"])
@Index("idx_order_item_product_sku", ["productId", "skuId"])
@Entity("biz_order_item")
export class BizOrderItem extends BaseEntity {
  @Column({ name: "order_id", type: "bigint", comment: "订单ID" })
  orderId: string;

  @Column({ name: "product_id", type: "bigint", comment: "商品ID" })
  productId: string;

  @Column({ name: "sku_id", type: "bigint", comment: "SKU ID" })
  skuId: string;

  @Column({ name: "product_name", length: 100, comment: "商品名称(下单快照)" })
  productName: string;

  @Column({ name: "product_image", length: 255, nullable: true, comment: "商品图片(下单快照)" })
  productImage?: string | null;

  @Column({ name: "sku_name", length: 100, nullable: true, comment: "规格名称(下单快照)" })
  skuName?: string | null;

  @Column({ type: "int", default: 0, comment: "单价(分,下单快照)" })
  price: number;

  @Column({ type: "int", default: 1, comment: "数量" })
  quantity: number;

  @Column({ type: "int", default: 0, comment: "小计(分)" })
  subtotal: number;
}
