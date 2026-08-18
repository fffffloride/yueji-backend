import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DecorationAdminController } from "./admin/decoration-admin.controller";
import { DecorationAppController } from "./app/decoration-app.controller";
import { DecorationService } from "./decoration.service";
import { DecorationBanner } from "./entities/banner.entity";
import { DecorationBrand } from "./entities/brand.entity";
import { DecorationNotice } from "./entities/decoration-notice.entity";

@Module({
  imports: [TypeOrmModule.forFeature([DecorationBanner, DecorationNotice, DecorationBrand])],
  controllers: [DecorationAdminController, DecorationAppController],
  providers: [DecorationService],
})
export class DecorationModule {}
