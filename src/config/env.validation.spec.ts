import { validateEnvironment } from "./env.validation";

const productionConfig = (): Record<string, unknown> => ({
  NODE_ENV: "prod",
  SESSION_TYPE: "jwt",
  PAYMENT_DRIVER: "wechat",
  MOCK_LOGIN_ENABLED: "false",
  MYSQL_HOST: "mysql",
  MYSQL_PORT: "3306",
  MYSQL_USER: "app",
  MYSQL_PASSWORD: "secret",
  MYSQL_DB: "youlai_admin",
  REDIS_HOST: "redis",
  REDIS_PORT: "6379",
  JWT_SECRET_KEY: "a".repeat(32),
  JWT_EXPIRES_IN: "7200",
  JWT_ISSUER: "yueji",
  OSS_TYPE: "local",
  OSS_LOCAL_STORAGE_PATH: "/data/uploads",
});

describe("validateEnvironment", () => {
  it("拒绝生产环境使用 Mock 支付", () => {
    expect(() => validateEnvironment({ ...productionConfig(), PAYMENT_DRIVER: "mock" })).toThrow(
      "生产环境禁止使用 Mock 支付驱动"
    );
  });

  it("拒绝生产环境缺失当前 OSS 驱动配置", () => {
    expect(() =>
      validateEnvironment({ ...productionConfig(), OSS_LOCAL_STORAGE_PATH: "" })
    ).toThrow("OSS_LOCAL_STORAGE_PATH");
  });

  it("拒绝生产环境启用 Swagger", () => {
    expect(() => validateEnvironment({ ...productionConfig(), SWAGGER_ENABLED: "true" })).toThrow(
      "生产环境禁止启用 Swagger"
    );
  });

  it("拒绝无效端口", () => {
    expect(() => validateEnvironment({ NODE_ENV: "dev", MYSQL_PORT: "abc" })).toThrow(
      "MYSQL_PORT 必须是正整数"
    );
  });

  it("接受完整生产配置", () => {
    expect(validateEnvironment(productionConfig())).toMatchObject({
      NODE_ENV: "prod",
      PAYMENT_DRIVER: "wechat",
      MOCK_LOGIN_ENABLED: "false",
      SWAGGER_ENABLED: "false",
    });
  });
});
