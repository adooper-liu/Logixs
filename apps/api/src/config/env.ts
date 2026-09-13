// 环境配置（P3-09）：端口/环境带默认值；DATABASE_URL 本地开发回退到 docker-compose 默认值
// （与 prisma.config.ts 一致），生产环境必须显式设置。
const LOCAL_DEV_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const LOCAL_DEV_AI_SERVICE_URL = "http://localhost:8001";
const LOCAL_DEV_SERVICE_ID = "logix-outbox-publisher";
const LOCAL_DEV_SERVICE_KEY = "dev-service-key";

export interface EnvConfig {
  port: number;
  databaseUrl: string;
  aiServiceUrl: string;
  nodeEnv: string;
  serviceId: string;
  serviceKey: string;
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
  };
}

export const config = readEnv();
