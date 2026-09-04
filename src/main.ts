import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe, HttpStatus } from "@nestjs/common";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { ConfigService } from "@nestjs/config";
import * as session from "express-session";
import { json } from "express";
import type { ValidationError } from "class-validator";
import { BusinessException } from "./common/exceptions/business.exception";
import { ErrorCode } from "./common/enums/error-code.enum";
import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  if (typeof (BigInt.prototype as any).toJSON !== "function") {
    (BigInt.prototype as any).toJSON = function () {
      return this.toString();
    };
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // 生产环境仅信任本机 Nginx 转发的客户端 IP，避免公开代付轮询共享 127.0.0.1 限流桶。
  app.set("trust proxy", "loopback");

  // 卡片最多包含 10 段富文本，单独放宽此保存接口的 JSON 大小。
  app.use("/api/v1/decoration/cards", json({ limit: "8mb" }));

  // 全局前缀
  app.setGlobalPrefix("/api/v1");

  // 跨域设置
  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // 全局拦截器
  // 传入 ConfigService 以支持日期格式化配置
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector), configService));

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors: ValidationError[]) => {
        const collect = (es: ValidationError[]): string[] => {
          const out: string[] = [];
          for (const e of es) {
            if (e.constraints) {
              out.push(...Object.values(e.constraints));
            }
            if (e.children && e.children.length > 0) {
              out.push(...collect(e.children));
            }
          }
          return out;
        };

        const messages = collect(errors)
          .map((m) => String(m).trim())
          .filter(Boolean);
        const msg = messages[0] || ErrorCode.USER_REQUEST_PARAMETER_ERROR.msg;
        return new BusinessException({
          code: ErrorCode.USER_REQUEST_PARAMETER_ERROR.code,
          msg,
          httpStatus: HttpStatus.BAD_REQUEST,
        });
      },
    })
  );

  // Swagger 默认仅在非生产环境启用；生产环境校验会拒绝 SWAGGER_ENABLED=true。
  const swaggerEnabled = configService.get<string>("SWAGGER_ENABLED", "false") === "true";
  if (swaggerEnabled) {
    // 接口约定：B 端管理接口走 /api/v1/**，C 端小程序接口统一走 /api/v1/app/**
    const APP_API_PREFIX = "/api/v1/app";

    const config = new DocumentBuilder()
      .setTitle("悦己DLumière 管理后台")
      .setDescription("B 端管理接口文档（/api/v1/**，不含 C 端 /api/v1/app/**）")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    document.paths = Object.fromEntries(
      Object.entries(document.paths).filter(([path]) => !path.startsWith(APP_API_PREFIX))
    );
    SwaggerModule.setup("api-docs", app, document, {
      swaggerOptions: { tagsSorter: "alpha" },
    });

    const appApiConfig = new DocumentBuilder()
      .setTitle("悦己DLumière 小程序")
      .setDescription("C 端小程序接口文档（/api/v1/app/**）")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const appApiDocument = SwaggerModule.createDocument(app, appApiConfig);
    appApiDocument.paths = Object.fromEntries(
      Object.entries(appApiDocument.paths).filter(([path]) => path.startsWith(APP_API_PREFIX))
    );
    SwaggerModule.setup("app-api-docs", app, appApiDocument, {
      swaggerOptions: { tagsSorter: "alpha" },
    });
  }

  // Session 配置
  app.use(
    session({
      secret: configService.getOrThrow<string>("jwt.secretKey"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7天
      },
    })
  );

  // 端口通过环境变量 SERVER_PORT 配置（默认 8000）
  const portRaw = configService.get("APP_PORT") ?? configService.get("SERVER_PORT") ?? 8000;
  const port = Number(portRaw) || 8000;
  await app.listen(port);
  logger.log(`应用已启动: http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`B端接口文档: http://localhost:${port}/api-docs`);
    logger.log(`C端接口文档: http://localhost:${port}/app-api-docs`);
  }
}

void bootstrap();
