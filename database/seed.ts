// 幂等种子：真实样本使用固定身份，重复执行不产生重复行（P4-04）。
// 运行：pnpm db:seed（需 DATABASE_URL 指向运行中的 PostgreSQL）。
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedAuthoritativeLocationReferenceData } from "./seeds/seed-authoritative-location-reference-data";
import { seedCargoOwnerReferenceData } from "./seeds/seed-cargo-owner-reference-data";
import { seedRealReplenishmentSample } from "./seeds/seed-real-replenishment-sample";

// 本地开发回退到 docker-compose 默认值（与 prisma.config.ts / apps/api config/env.ts 一致）。
const LOCAL_DEV_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";

const connectionString = process.env.DATABASE_URL ?? LOCAL_DEV_DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main(): Promise<void> {
  const referenceData = await seedAuthoritativeLocationReferenceData(prisma);
  console.log(
    `Seeded authoritative reference data: ${referenceData.countryCount} countries, ` +
      `${referenceData.portCount} ports, ${referenceData.portEntryCount} official port entries, ` +
      `${referenceData.aliasCandidateCount} sample alias candidates.`,
  );
  const cargoOwners = await seedCargoOwnerReferenceData(prisma);
  console.log(
    `Seeded internal cargo owner mappings: ${cargoOwners.cargoOwnerCount} confirmed owners.`,
  );
  const realSample = await seedRealReplenishmentSample(prisma);
  console.log(
    `Seeded real replenishment sample ${realSample.tenantId}: ` +
      `${realSample.replenishmentOrderCount} orders, ` +
      `${realSample.containerCount} containers, ` +
      `${realSample.productSkuCount} SKUs, ` +
      `${realSample.replenishmentOrderLineCount} lines, ` +
      `${realSample.allocationSetCount} allocation sets, ` +
      `${realSample.allocationCount} allocations.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
