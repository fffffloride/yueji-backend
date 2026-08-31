import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AgreementAdminController } from "./admin/agreement-admin.controller";
import { AgreementAppController } from "./app/agreement-app.controller";
import { AgreementService } from "./agreement.service";
import { Agreement } from "./entities/agreement.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Agreement])],
  controllers: [AgreementAdminController, AgreementAppController],
  providers: [AgreementService],
})
export class AgreementModule {}
