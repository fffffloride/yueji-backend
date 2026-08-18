import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("decoration_brand")
export class DecorationBrand extends BaseEntity {
  @Column({ type: "longtext" })
  content: string;
}
