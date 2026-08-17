import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { MemberLevelService } from "../member-level.service";
import { MemberLevelSaveDto, PageDto } from "../dto/marketing.dto";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("17.会员等级")
@Controller("member-levels")
export class MemberLevelAdminController {
  constructor(private readonly service: MemberLevelService) {}

  @Get("page")
  @Permissions("biz:member-level:list")
  page(@Query() query: PageDto) {
    return this.service.page(query);
  }

  @Get("list")
  @Permissions("biz:member-level:list")
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions("biz:member-level:create")
  @ApiOperation({ summary: "新增会员等级" })
  create(@Body() dto: MemberLevelSaveDto) {
    return this.service.create(dto);
  }

  @Put(":id")
  @Permissions("biz:member-level:update")
  update(@Param("id") id: string, @Body() dto: MemberLevelSaveDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Permissions("biz:member-level:delete")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
