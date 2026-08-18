import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";

import { METADATA } from "../constants/metadata.constant";

export const IS_MEMBER_API_KEY = METADATA.MEMBER_API;

/**
 * C端会员接口装饰器
 *
 * 作用：
 * 1. 标记 MEMBER_API 元数据，使全局 JwtAuthGuard（管理员鉴权）跳过该接口
 * 2. 由全局 MemberJwtGuard 执行会员 Token 和账号状态校验
 *
 * 用法：加在 app controller 类或方法上
 */
export const MemberAuth = () =>
  applyDecorators(SetMetadata(IS_MEMBER_API_KEY, true), ApiBearerAuth());
