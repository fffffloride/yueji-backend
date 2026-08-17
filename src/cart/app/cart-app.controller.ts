import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CartService } from "../cart.service";
import { CartAddDto } from "../dto/cart-add.dto";
import { CartUpdateDto } from "../dto/cart-update.dto";
import { MemberAuth } from "@/common/decorators/member-auth.decorator";
import { CurrentMember } from "@/common/decorators/current-member.decorator";
import type { CurrentMemberInfo } from "@/common/interfaces/current-member.interface";

@ApiTags("C04.购物车")
@MemberAuth()
@Controller("app/cart")
export class CartAppController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: "购物车列表" })
  @Get()
  async list(@CurrentMember() member: CurrentMemberInfo) {
    return this.cartService.list(member.memberId);
  }

  @ApiOperation({ summary: "加入购物车(同SKU合并数量)" })
  @Post()
  async add(@CurrentMember() member: CurrentMemberInfo, @Body() dto: CartAddDto) {
    return this.cartService.add(member.memberId, dto);
  }

  @ApiOperation({ summary: "修改数量/选中" })
  @Put(":id")
  async update(
    @CurrentMember() member: CurrentMemberInfo,
    @Param("id") id: string,
    @Body() dto: CartUpdateDto
  ) {
    return this.cartService.update(member.memberId, id, dto);
  }

  @ApiOperation({ summary: "删除购物车项" })
  @Delete(":id")
  async remove(@CurrentMember() member: CurrentMemberInfo, @Param("id") id: string) {
    await this.cartService.remove(member.memberId, id);
  }
}
