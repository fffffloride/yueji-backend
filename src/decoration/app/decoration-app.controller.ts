import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { DecorationService } from "../decoration.service";
import { Public } from "@/common/decorators/auth.decorator";

@ApiTags("C08.首页装修")
@Public()
@Controller("app/decoration")
export class DecorationAppController {
  constructor(private readonly service: DecorationService) {}

  @ApiOperation({ summary: "首页装修聚合数据" })
  @Get("home")
  home() {
    return this.service.appHome();
  }
}
