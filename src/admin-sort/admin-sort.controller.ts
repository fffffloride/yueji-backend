import { Body, Controller, Param, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AdminSortService } from "./admin-sort.service";
import { MovePositionDto } from "@/common/dto/move-position.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("后台排序")
@Controller()
export class AdminSortController {
  constructor(private readonly service: AdminSortService) {}

  @ApiOperation({ summary: "调整商品全局位置" })
  @Permissions("biz:product:update")
  @Patch("products/:id/position")
  moveProduct(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveProduct(id, dto);
  }

  @ApiOperation({ summary: "调整同级商品分类位置" })
  @Permissions("biz:product-category:update")
  @Patch("product-categories/:id/position")
  moveProductCategory(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveProductCategory(id, dto);
  }

  @ApiOperation({ summary: "调整 Banner 位置" })
  @Permissions("biz:decoration:banner:update")
  @Patch("decoration/banners/:id/position")
  moveBanner(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveBanner(id, dto);
  }

  @ApiOperation({ summary: "调整公告位置" })
  @Permissions("biz:decoration:notice:update")
  @Patch("decoration/notices/:id/position")
  moveNotice(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveNotice(id, dto);
  }

  @ApiOperation({ summary: "调整代理类型位置" })
  @Permissions("biz:distribution:type:update")
  @Patch("distribution/agent-types/:id/position")
  moveAgentType(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveAgentType(id, dto);
  }

  @ApiOperation({ summary: "调整角色位置" })
  @Permissions("sys:role:update")
  @Patch("roles/:id/position")
  moveRole(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveRole(id, dto);
  }

  @ApiOperation({ summary: "调整字典项位置" })
  @Permissions("sys:dict-item:update")
  @Patch("dicts/:dictCode/items/:id/position")
  moveDictItem(
    @Param("dictCode") dictCode: string,
    @Param("id") id: string,
    @Body() dto: MovePositionDto
  ) {
    return this.service.moveDictItem(dictCode, id, dto);
  }

  @ApiOperation({ summary: "调整同级部门位置" })
  @Permissions("sys:dept:update")
  @Patch("depts/:id/position")
  moveDept(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveDept(id, dto);
  }

  @ApiOperation({ summary: "调整同级菜单位置" })
  @Permissions("sys:menu:update")
  @Patch("menus/:id/position")
  moveMenu(@Param("id") id: string, @Body() dto: MovePositionDto) {
    return this.service.moveMenu(id, dto);
  }
}
