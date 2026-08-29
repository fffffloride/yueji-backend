const NODE_ENVS = new Set(["dev", "test", "prod"]);
const SESSION_TYPES = new Set(["jwt", "redis-token"]);
const PAYMENT_DRIVERS = new Set(["mock", "wechat"]);
const OSS_TYPES = new Set(["minio", "aliyun", "local"]);
const BOOLEAN_VALUES = new Set(["true", "false"]);

const valueOf = (config: Record<string, unknown>, key: string): string =>
  String(config[key] ?? "").trim();

const requireKeys = (config: Record<string, unknown>, keys: string[]): void => {
  const missing = keys.filter((key) => !valueOf(config, key));
  if (missing.length > 0) {
    throw new Error(`生产环境缺少必需配置：${missing.join(", ")}`);
  }
};

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...config };
  const nodeEnv = valueOf(config, "NODE_ENV").toLowerCase() || "dev";
  const sessionType = valueOf(config, "SESSION_TYPE").toLowerCase() || "jwt";
  const paymentDriver = valueOf(config, "PAYMENT_DRIVER").toLowerCase() || "mock";
  const ossType = valueOf(config, "OSS_TYPE").toLowerCase() || "minio";
  const mockLogin = valueOf(config, "MOCK_LOGIN_ENABLED").toLowerCase() || "false";
  const swaggerEnabled =
    valueOf(config, "SWAGGER_ENABLED").toLowerCase() || (nodeEnv === "prod" ? "false" : "true");

  if (!NODE_ENVS.has(nodeEnv)) throw new Error(`NODE_ENV 不支持：${nodeEnv}`);
  if (!SESSION_TYPES.has(sessionType)) throw new Error(`SESSION_TYPE 不支持：${sessionType}`);
  if (!PAYMENT_DRIVERS.has(paymentDriver)) {
    throw new Error(`PAYMENT_DRIVER 不支持：${paymentDriver}`);
  }
  if (!OSS_TYPES.has(ossType)) throw new Error(`OSS_TYPE 不支持：${ossType}`);
  if (!BOOLEAN_VALUES.has(mockLogin)) {
    throw new Error("MOCK_LOGIN_ENABLED 只能是 true 或 false");
  }
  if (!BOOLEAN_VALUES.has(swaggerEnabled)) {
    throw new Error("SWAGGER_ENABLED 只能是 true 或 false");
  }

  for (const key of [
    "APP_PORT",
    "MYSQL_PORT",
    "REDIS_PORT",
    "JWT_EXPIRES_IN",
    "ORDER_PAY_TIMEOUT_MINUTES",
  ]) {
    const value = valueOf(config, key);
    if (value && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
      throw new Error(`${key} 必须是正整数`);
    }
  }

  Object.assign(normalized, {
    NODE_ENV: nodeEnv,
    SESSION_TYPE: sessionType,
    PAYMENT_DRIVER: paymentDriver,
    OSS_TYPE: ossType,
    MOCK_LOGIN_ENABLED: mockLogin,
    SWAGGER_ENABLED: swaggerEnabled,
  });

  if (nodeEnv !== "prod") return normalized;
  if (paymentDriver === "mock") throw new Error("生产环境禁止使用 Mock 支付驱动");
  if (mockLogin === "true") throw new Error("生产环境禁止启用 Mock 登录");
  if (swaggerEnabled === "true") throw new Error("生产环境禁止启用 Swagger");

  requireKeys(normalized, [
    "MYSQL_HOST",
    "MYSQL_PORT",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_DB",
    "REDIS_HOST",
    "REDIS_PORT",
    "JWT_SECRET_KEY",
    "JWT_EXPIRES_IN",
    "JWT_ISSUER",
  ]);

  if (valueOf(normalized, "JWT_SECRET_KEY").length < 32) {
    throw new Error("生产环境 JWT_SECRET_KEY 长度不能少于 32 个字符");
  }

  const ossRequired = {
    minio: [
      "OSS_MINIO_ENDPOINT",
      "OSS_MINIO_ACCESS_KEY",
      "OSS_MINIO_SECRET_KEY",
      "OSS_MINIO_BUCKET",
    ],
    aliyun: [
      "OSS_ALIYUN_ENDPOINT",
      "OSS_ALIYUN_ACCESS_KEY_ID",
      "OSS_ALIYUN_ACCESS_KEY_SECRET",
      "OSS_ALIYUN_BUCKET",
    ],
    local: ["OSS_LOCAL_STORAGE_PATH"],
  } as const;
  requireKeys(normalized, [...ossRequired[ossType as keyof typeof ossRequired]]);

  return normalized;
}
