import { Column, Entity } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";

@Entity("decoration_notice")
export class DecorationNotice extends BaseEntity {
  @Column({ length: 100 })
  title: string;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "int", default: 0 })
  sort: number;

  @Column({ type: "tinyint", default: 1 })
  status: number;
}
