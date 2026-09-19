import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DecorationAdminController } from "./admin/decoration-admin.controller";
import { DecorationAppController } from "./app/decoration-app.controller";
import { DecorationService } from "./decoration.service";
import { DecorationBanner } from "./entities/banner.entity";
import { DecorationBrand } from "./entities/brand.entity";
import { DecorationNotice } from "./entities/decoration-notice.entity";

import { DecorationHomeCards } from "./entities/home-cards.entity";
import { DecorationPromoCards } from "./entities/promo-cards.entity";
import { MarketingModule } from "@/marketing/marketing.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DecorationBanner,
      DecorationNotice,
      DecorationBrand,
      DecorationHomeCards,
      DecorationPromoCards,
    ]),
    MarketingModule,
  ],
  controllers: [DecorationAdminController, DecorationAppController],
  providers: [DecorationService],
})
export class DecorationModule {}
