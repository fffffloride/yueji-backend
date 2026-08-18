import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { GroupBuyAdminController } from "./admin/group-buy-admin.controller";
import {
  GroupBuyAppMemberController,
  GroupBuyAppPublicController,
} from "./app/group-buy-app.controller";
import { GroupBuyActivity } from "./entities/group-buy-activity.entity";
import { GroupBuyGroup } from "./entities/group-buy-group.entity";
import { GroupBuyMember } from "./entities/group-buy-member.entity";
import { GroupBuyService } from "./group-buy.service";
import { GroupBuyTask } from "./group-buy.task";
import { OrderModule } from "@/order/order.module";
import { PaymentModule } from "@/payment/payment.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupBuyActivity, GroupBuyGroup, GroupBuyMember]),
    OrderModule,
    PaymentModule,
  ],
  controllers: [GroupBuyAdminController, GroupBuyAppPublicController, GroupBuyAppMemberController],
  providers: [GroupBuyService, GroupBuyTask],
})
export class GroupBuyModule {}
