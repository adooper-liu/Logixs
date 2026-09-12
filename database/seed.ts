// 幂等种子：按固定 id upsert，重复执行不产生重复行（P4-04）。
// 运行：pnpm db:seed（需 DATABASE_URL 指向运行中的 PostgreSQL）。
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

// 本地开发回退到 docker-compose 默认值（与 prisma.config.ts / apps/api config/env.ts 一致）。
const LOCAL_DEV_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

const connectionString = process.env.DATABASE_URL ?? LOCAL_DEV_DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

// 薄真实切片验证用的最小样本：3 个货柜覆盖不同状态，字段口径见 DATA_MODEL_P2-06。
const samples = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    orderNumber: "SO-2026-0001",
    mainOrderNumber: "PO-2026-A001",
    containerNumber: "MSKU1234567",
    currentStatus: "in_transit",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    orderNumber: "SO-2026-0002",
    mainOrderNumber: "PO-2026-A002",
    containerNumber: "TGHU7654321",
    currentStatus: "at_port",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    orderNumber: "SO-2026-0003",
    mainOrderNumber: "PO-2026-A003",
    containerNumber: null, // 迟绑定：箱号尚未产生
    currentStatus: "not_shipped",
  },
] as const;

async function main(): Promise<void> {
  for (const sample of samples) {
    await prisma.containerRecord.upsert({
      where: { id: sample.id },
      create: { ...sample, tenantId: TENANT_ID },
      update: { ...sample, tenantId: TENANT_ID },
    });
  }
  const count = await prisma.containerRecord.count();
  console.log(`Seeded container_record; total rows now: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
