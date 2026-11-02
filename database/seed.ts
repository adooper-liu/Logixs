// 幂等种子：真实样本使用固定身份，重复执行不产生重复行（P4-04）。
// 运行：pnpm db:seed（需 DATABASE_URL 指向运行中的 PostgreSQL）。
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedAuthoritativeLocationReferenceData } from "./seeds/seed-authoritative-location-reference-data";
import { seedInternalOceanReferenceData } from "./seeds/seed-internal-ocean-reference-data";
import { seedCargoOwnerReferenceData } from "./seeds/seed-cargo-owner-reference-data";
import { seedExternalOceanReferenceMappings } from "./seeds/seed-external-ocean-reference-mappings";
import { seedOceanReferenceV11 } from "./seeds/seed-ocean-reference-v1.1";

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
  const internalOcean = await seedInternalOceanReferenceData(prisma);
  console.log(
    `Seeded internal ocean baseline: ${internalOcean.carrierCount} carriers, ${internalOcean.containerTypeCount} container types.`,
  );
  const directory = await seedOceanReferenceV11(prisma);
  console.log(
    `Seeded internal ocean ${directory.version}: ${directory.carriers} source carriers, ${directory.selectableCarriers} selectable, ${directory.containerTypes} container types with standard basis.`,
  );
  const cargoOwners = await seedCargoOwnerReferenceData(prisma);
  console.log(
    `Seeded internal cargo owner mappings: ${cargoOwners.cargoOwnerCount} confirmed owners.`,
  );
  const externalOceanMappings =
    await seedExternalOceanReferenceMappings(prisma);
  console.log(
    `Seeded sparse external ocean mappings: ${externalOceanMappings.profileCount} profiles, ${externalOceanMappings.mappingCount} candidate mappings.`,
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
