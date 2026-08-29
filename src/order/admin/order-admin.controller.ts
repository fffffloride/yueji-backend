import { Body, Controller, Get, Param, Post, Query, Res, SetMetadata } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response as ExpressResponse } from "express";
import * as XLSX from "xlsx";

import { OrderService } from "../order.service";
import { OrderQueryDto } from "../dto/order-query.dto";
import { OrderVerifyDto } from "../dto/order-verify.dto";
import { Permissions } from "@/common/decorators/auth.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { CurrentUserInfo } from "@/common/interfaces/current-user.interface";
import { RateLimit } from "@/common/decorators/rate-limit.decorator";

@ApiTags("16.订单管理")
@Controller("orders")
export class OrderAdminController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: "订单分页列表" })
  @Get("page")
  @Permissions("biz:order:list")
  async page(@Query() query: OrderQueryDto) {
    return this.orderService.adminPage(query);
  }

  @ApiOperation({ summary: "导出订单" })
  @Get("export")
  @Permissions("biz:order:export")
  @RateLimit({ limit: 3, windowSec: 60 })
  @SetMetadata("skipResponseTransform", true)
  async export(@Query() query: OrderQueryDto, @Res() res: ExpressResponse) {
    const list = await this.orderService.listExport(query);
    const headers = [
      "订单号",
      "状态",
      "商品总额(分)",
      "实付(分)",
      "会员昵称",
      "会员手机",
      "联系人",
      "联系电话",
      "核销码",
      "下单时间",
      "支付时间",
    ];
    const rows = list.map((o) => [
      o.orderNo,
      o.statusLabel,
      o.totalAmount,
      o.payAmount,
      o.memberNickname,
      o.memberMobile,
      o.contactName,
      o.contactMobile,
      o.verifyCode,
      o.createTime,
      o.payTime,
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "订单列表");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const fileName = "订单列表.xlsx";
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(fileName)}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  }

  @ApiOperation({ summary: "按核销码核销" })
  @Post("verify")
  @Permissions("biz:order:verify")
  async verifyByCode(@Body() dto: OrderVerifyDto, @CurrentUser() user: CurrentUserInfo) {
    return this.orderService.verifyByCode(dto.verifyCode, user.userId);
  }

  @ApiOperation({ summary: "订单详情" })
  @Get(":id")
  @Permissions("biz:order:list")
  async detail(@Param("id") id: string) {
    return this.orderService.getDetail(id);
  }

  @ApiOperation({ summary: "按订单核销" })
  @Post(":id/verify")
  @Permissions("biz:order:verify")
  async verifyById(@Param("id") id: string, @CurrentUser() user: CurrentUserInfo) {
    return this.orderService.verifyById(id, user.userId);
  }
}
