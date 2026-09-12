// 环境配置（P3-09）：启动时校验必需变量，缺失即失败，不使用静默默认值。
export interface EnvConfig {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
}

function readEnv(): EnvConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required; see .env.example");
  }
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl,
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export const config = readEnv();
