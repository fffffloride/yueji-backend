import { Module } from "@nestjs/common";

import { WechatAccessTokenService } from "./wechat-access-token.service";
import { RedisSharedModule } from "../redis/redis.module";

@Module({
  imports: [RedisSharedModule],
  providers: [WechatAccessTokenService],
  exports: [WechatAccessTokenService],
})
export class WechatModule {}
