import {
  Controller,
  Get,
  Headers,
  Injectable,
  OnApplicationBootstrap,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Public } from "../common/decorators/auth.decorator";
import { AppointmentService } from "../appointment/appointment.service";
import { AppointmentQueryDto } from "../appointment/dto/appointment-query.dto";
import { OrderService } from "../order/order.service";
import { OrderQueryDto } from "../order/dto/order-query.dto";

export function validReadinessSignature(secret: string, timestamp: string, signature: string) {
  if (!/^\d{10}$/.test(timestamp || "") || !/^[a-f0-9]{64}$/.test(signature || "")) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 30) return false;
  const expected = createHmac("sha256", secret)
    .update(`yueji-release-readiness:v1:${timestamp}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

@Injectable()
export class ReadinessService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DataSource,
    private readonly appointments: AppointmentService,
    private readonly orders: OrderService
  ) {}

  async onApplicationBootstrap() {
    await this.checkColumns();
  }

  async checkColumns() {
    // LIMIT 0 resolves every mapped column, including columns omitted by lists,
    // without reading or exposing business records. Never synchronize the schema.
    for (const table of this.db.entityMetadatas) {
      const columns = table.columns.map((column) => this.db.driver.escape(column.databaseName));
      await this.db.query(
        `SELECT ${columns.join(",")} FROM ${this.db.driver.escape(table.tableName)} LIMIT 0`
      );
    }
  }

  async checkBusiness() {
    await this.checkColumns();
    const config = await this.db.query(
      "SELECT slot_capacity FROM appointment_config WHERE id=1 AND is_deleted=0"
    );
    if (config.length !== 1 || Number(config[0].slot_capacity) < 1)
      throw new Error("Appointment configuration missing");
    await this.appointments.getConfig();
    await this.appointments.getAdminSummary();
    const appointmentQuery = Object.assign(new AppointmentQueryDto(), { pageNum: 1, pageSize: 1 });
    await this.appointments.pageQuery(appointmentQuery);
    const orderQuery = Object.assign(new OrderQueryDto(), { pageNum: 1, pageSize: 1 });
    const orders = await this.orders.adminPage(orderQuery);
    if (orders.data.length) await this.orders.getDetail(orders.data[0].id);
    // No customer data, order IDs or configuration values leave this endpoint.
    return { ready: true };
  }
}

@Controller("internal/readiness")
export class ReadinessController {
  constructor(
    private readonly readiness: ReadinessService,
    private readonly config: ConfigService
  ) {}

  @Public()
  @Get()
  async check(
    @Headers("x-readiness-time") timestamp: string,
    @Headers("x-readiness-signature") signature: string
  ) {
    if (
      !validReadinessSignature(
        this.config.getOrThrow<string>("jwt.secretKey"),
        timestamp,
        signature
      )
    )
      throw new UnauthorizedException();
    try {
      return await this.readiness.checkBusiness();
    } catch {
      throw new ServiceUnavailableException("Business readiness check failed");
    }
  }
}
