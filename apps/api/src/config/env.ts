// 环境配置（P3-09）：端口/环境带默认值；DATABASE_URL 本地开发回退到 docker-compose 默认值
// （与 prisma.config.ts 一致），生产环境必须显式设置。
const LOCAL_DEV_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

export interface EnvConfig {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
}

function readEnv(): EnvConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL ?? LOCAL_DEV_DATABASE_URL,
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export const config = readEnv();
