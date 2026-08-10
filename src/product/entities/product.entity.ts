import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("product")
export class Product extends BaseEntity {
  @Column({ length: 100, comment: "商品名称" })
  name: string;

  @Column({ name: "category_id", type: "bigint", comment: "分类ID" })
  categoryId: string;

  @Column({ name: "sub_title", length: 255, nullable: true, comment: "副标题" })
  subTitle?: string | null;

  @Column({ name: "main_image", length: 255, nullable: true, comment: "主图URL" })
  mainImage?: string | null;

  @Column({ type: "text", nullable: true, comment: "轮播图URL列表(JSON数组)" })
  album?: string | null;

  @Column({ name: "video_url", length: 255, nullable: true, comment: "短视频URL" })
  videoUrl?: string | null;

  @Column({ length: 255, nullable: true, comment: "标签(逗号分隔：推荐,新品,热卖)" })
  tags?: string | null;

  @Column({ name: "original_price", type: "int", nullable: true, comment: "原价(分)" })
  originalPrice?: number | null;

  @Column({ type: "int", default: 0, comment: "现售价(分)" })
  price: number;

  @Column({ type: "int", default: 0, comment: "销量" })
  sales: number;

  @Column({ type: "int", default: 0, comment: "总库存(SKU库存之和)" })
  stock: number;

  @Column({ type: "mediumtext", nullable: true, comment: "商品详情(富文本)" })
  detail?: string | null;

  @Column({ name: "usage_note", type: "text", nullable: true, comment: "产品说明" })
  usageNote?: string | null;

  @Column({ type: "tinyint", default: 0, comment: "状态(1-上架 0-下架)" })
  status: number;

  @Column({ type: "smallint", default: 0, comment: "显示顺序" })
  sort: number;
}
