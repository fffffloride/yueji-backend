import { Controller, Get, Param, ParseEnumPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AgreementType } from "../agreement.constants";
import { AgreementService } from "../agreement.service";
import { Public } from "@/common/decorators/auth.decorator";

@ApiTags("C10.协议")
@Public()
@Controller("app/agreements")
export class AgreementAppController {
  constructor(private readonly service: AgreementService) {}

  @ApiOperation({ summary: "已发布协议" })
  @Get(":type")
  get(@Param("type", new ParseEnumPipe(AgreementType)) type: AgreementType) {
    return this.service.published(type);
  }
}
