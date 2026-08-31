import { Body, Controller, Get, Param, ParseEnumPipe, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AgreementType } from "../agreement.constants";
import { AgreementDraftDto } from "../dto/agreement.dto";
import { AgreementService } from "../agreement.service";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permissions } from "@/common/decorators/auth.decorator";

@ApiTags("21.协议管理")
@Controller("agreements")
export class AgreementAdminController {
  constructor(private readonly service: AgreementService) {}

  @ApiOperation({ summary: "协议列表" })
  @Get()
  @Permissions("content:agreement:list")
  list() {
    return this.service.list();
  }

  @ApiOperation({ summary: "协议草稿" })
  @Get(":type/form")
  @Permissions("content:agreement:list")
  form(@Param("type", new ParseEnumPipe(AgreementType)) type: AgreementType) {
    return this.service.form(type);
  }

  @ApiOperation({ summary: "保存协议草稿" })
  @Put(":type")
  @Permissions("content:agreement:update")
  saveDraft(
    @Param("type", new ParseEnumPipe(AgreementType)) type: AgreementType,
    @Body() dto: AgreementDraftDto,
    @CurrentUser("userId") userId: string
  ) {
    return this.service.saveDraft(type, dto, userId);
  }

  @ApiOperation({ summary: "发布协议" })
  @Put(":type/publish")
  @Permissions("content:agreement:publish")
  publish(
    @Param("type", new ParseEnumPipe(AgreementType)) type: AgreementType,
    @CurrentUser("userId") userId: string
  ) {
    return this.service.publish(type, userId);
  }
}
