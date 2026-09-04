import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";
import type { HomeCardDto } from "../dto/decoration.dto";

@Entity("decoration_home_cards")
export class DecorationHomeCards extends BaseEntity {
  @Column({ type: "json" })
  cards: HomeCardDto[];
}
