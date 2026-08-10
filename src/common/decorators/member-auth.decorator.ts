import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";

import { METADATA } from "../constants/metadata.constant";
import { MemberJwtGuard } from "../guards/member-jwt.guard";

export const IS_MEMBER_API_KEY = METADATA.MEMBER_API;

/**
 * C端会员接口装饰器
 *
 * 作用：
 * 1. 标记 MEMBER_API 元数据，使全局 JwtAuthGuard（管理员鉴权）跳过该接口
 * 2. 挂载 MemberJwtGuard 执行会员 Token 校验
 *
 * 用法：加在 app controller 类或方法上
 */
export const MemberAuth = () =>
  applyDecorators(SetMetadata(IS_MEMBER_API_KEY, true), UseGuards(MemberJwtGuard), ApiBearerAuth());
