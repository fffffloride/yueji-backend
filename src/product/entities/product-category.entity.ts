import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";

@Entity("product_category")
export class ProductCategory extends BaseEntity {
  @Column({ length: 64, comment: "分类名称" })
  name: string;

  @Column({ name: "parent_id", type: "bigint", default: 0, comment: "父分类ID(0为顶级)" })
  parentId: string;

  @Column({ name: "tree_path", length: 255, default: "0", comment: "父节点ID路径" })
  treePath: string;

  @Column({ type: "tinyint", default: 1, comment: "层级(1/2/3)" })
  level: number;

  @Column({ length: 255, nullable: true, comment: "分类图标" })
  icon?: string | null;

  @Column({ type: "smallint", default: 0, comment: "显示顺序" })
  sort: number;

  @Column({ type: "tinyint", default: 1, comment: "状态(1-启用 0-禁用)" })
  status: number;
}
