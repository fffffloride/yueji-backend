import { Column, Entity } from "typeorm";
import { BaseEntity } from "@/common/entities/base.entity";
import type { PromoCardDto } from "../dto/decoration.dto";

@Entity("decoration_promo_cards")
export class DecorationPromoCards extends BaseEntity {
  @Column({ type: "json" })
  cards: PromoCardDto[];
}
