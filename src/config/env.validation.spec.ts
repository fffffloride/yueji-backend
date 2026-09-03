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
  WX_MINIAPP_APP_ID: "wx-app",
  WX_MINIAPP_APP_SECRET: "app-secret",
  WX_PAY_MCH_ID: "1900000109",
  WX_PAY_API_V3_KEY: "a".repeat(32),
  WX_PAY_MERCHANT_SERIAL_NO: "SERIAL",
  WX_PAY_MERCHANT_PRIVATE_KEY_PATH: "/run/secrets/apiclient_key.pem",
  WX_PAY_PLATFORM_KEYS_JSON: JSON.stringify({ PUB_KEY_ID_1: "public-key" }),
  WX_PAY_NOTIFY_URL: "https://api.example.com/api/v1/app/payment/wechat/notify",
  WX_PAY_REFUND_NOTIFY_URL: "https://api.example.com/api/v1/app/payment/wechat/refund-notify",
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

  it("mock 开发环境不要求微信支付密钥", () => {
    expect(validateEnvironment({ NODE_ENV: "dev", PAYMENT_DRIVER: "mock" })).toMatchObject({
      PAYMENT_DRIVER: "mock",
    });
  });

  it("选择微信驱动时立即校验支付配置", () => {
    expect(() => validateEnvironment({ NODE_ENV: "dev", PAYMENT_DRIVER: "wechat" })).toThrow(
      "WX_PAY_MCH_ID"
    );
  });

  it("拒绝非 HTTPS 微信回调地址", () => {
    expect(() =>
      validateEnvironment({ ...productionConfig(), WX_PAY_NOTIFY_URL: "http://localhost/notify" })
    ).toThrow("WX_PAY_NOTIFY_URL 必须是公网 HTTPS 地址");
  });
});
