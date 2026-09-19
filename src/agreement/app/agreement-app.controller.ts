import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AgreementService } from "../agreement.service";
import { Public } from "@/common/decorators/auth.decorator";

@ApiTags("C10.协议")
@Public()
@Controller("app/agreements")
export class AgreementAppController {
  constructor(private readonly service: AgreementService) {}

  @ApiOperation({ summary: "协议列表" })
  @Get()
  list() {
    return this.service.listPublic();
  }

  @ApiOperation({ summary: "已发布协议" })
  @Get(":type")
  get(@Param("type") type: string) {
    return this.service.published(type);
  }
}
