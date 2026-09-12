import { defineConfig } from "prisma/config";

// Prisma 7 配置：连接 URL 不再写在 schema 里，而是这里 + 运行时 driver adapter。
// 本地开发默认（docker-compose PostgreSQL）仅作 generate 等离线命令的回退；
// 迁移/种子等真正连库的命令应从运行环境注入 DATABASE_URL（见 .env.example）。
const localDevUrl =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

export default defineConfig({
  schema: "database/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? localDevUrl,
  },
  migrations: {
    path: "database/migrations",
    seed: "tsx database/seed.ts",
  },
});
