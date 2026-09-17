// 环境配置（P3-09）：端口/环境带默认值；DATABASE_URL 本地开发回退到 docker-compose 默认值
// （与 prisma.config.ts 一致），生产环境必须显式设置。
const LOCAL_DEV_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const LOCAL_DEV_AI_SERVICE_URL = "http://localhost:8001";
const LOCAL_DEV_SERVICE_ID = "logix-outbox-publisher";
const LOCAL_DEV_SERVICE_KEY = "dev-service-key";
const LOCAL_DEV_OBJECT_STORAGE_ENDPOINT = "http://localhost:9000";
const LOCAL_DEV_OBJECT_STORAGE_ACCESS_KEY = "logix";
const LOCAL_DEV_OBJECT_STORAGE_SECRET_KEY = "logix-dev-secret";

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  allowBucketCreation: boolean;
  timeoutMs: number;
}

export interface EnvConfig {
  port: number;
  databaseUrl: string;
  aiServiceUrl: string;
  nodeEnv: string;
  serviceId: string;
  serviceKey: string;
  importSourceStorage: ObjectStorageConfig;
}

function readEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL ?? LOCAL_DEV_DATABASE_URL,
    aiServiceUrl: process.env.AI_SERVICE_URL ?? LOCAL_DEV_AI_SERVICE_URL,
    nodeEnv,
    serviceId:
      process.env.LOGIX_SERVICE_ID ??
      (isProduction ? "" : LOCAL_DEV_SERVICE_ID),
    serviceKey:
      process.env.LOGIX_SERVICE_KEY ??
      (isProduction ? "" : LOCAL_DEV_SERVICE_KEY),
    importSourceStorage: {
      endpoint:
        process.env.OBJECT_STORAGE_ENDPOINT ??
        (isProduction ? "" : LOCAL_DEV_OBJECT_STORAGE_ENDPOINT),
      region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1",
      bucket: process.env.IMPORT_SOURCE_BUCKET ?? "logix-import-sources",
      accessKey:
        process.env.OBJECT_STORAGE_ACCESS_KEY ??
        (isProduction ? "" : LOCAL_DEV_OBJECT_STORAGE_ACCESS_KEY),
      secretKey:
        process.env.OBJECT_STORAGE_SECRET_KEY ??
        (isProduction ? "" : LOCAL_DEV_OBJECT_STORAGE_SECRET_KEY),
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
      allowBucketCreation:
        !isProduction && process.env.OBJECT_STORAGE_AUTO_CREATE !== "false",
      timeoutMs: Number(process.env.OBJECT_STORAGE_TIMEOUT_MS ?? 10_000),
    },
  };
}

export const config = readEnv();
