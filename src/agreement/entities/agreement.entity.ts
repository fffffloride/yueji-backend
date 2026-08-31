import { Column, Entity, Index } from "typeorm";

import { BaseEntity } from "@/common/entities/base.entity";
import { AgreementType } from "../agreement.constants";

@Entity("agreement")
@Index("uk_agreement_type", ["type"], { unique: true })
export class Agreement extends BaseEntity {
  @Column({ length: 32 })
  type: AgreementType;

  @Column({ name: "draft_title", length: 100 })
  draftTitle: string;

  @Column({ name: "draft_content", type: "text" })
  draftContent: string;

  @Column({ name: "published_title", length: 100, nullable: true })
  publishedTitle?: string | null;

  @Column({ name: "published_content", type: "text", nullable: true })
  publishedContent?: string | null;

  @Column({ name: "publish_time", type: "datetime", nullable: true })
  publishTime?: Date | null;
}
