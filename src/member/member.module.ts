import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Member } from "./entities/member.entity";
import { MemberService } from "./member.service";
import { MemberAdminController } from "./admin/member-admin.controller";
import { MemberAppController } from "./app/member-app.controller";
import { BizOrder } from "@/order/entities/order.entity";
import { MemberLevel } from "@/marketing/entities/member-level.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Member, BizOrder, MemberLevel])],
  controllers: [MemberAdminController, MemberAppController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
