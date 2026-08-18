import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("decoration_banner")
export class DecorationBanner extends BaseEntity {
  @Column({ name: "image_url", length: 500 })
  imageUrl: string;

  @Column({ name: "link_url", length: 500, nullable: true })
  linkUrl?: string | null;

  @Column({ type: "int", default: 0 })
  sort: number;

  @Column({ type: "tinyint", default: 1 })
  status: number;
}
