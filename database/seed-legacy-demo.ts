import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedRealReplenishmentSample } from "./seeds/seed-real-replenishment-sample";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main(): Promise<void> {
  const result = await seedRealReplenishmentSample(prisma);
  console.log(
    `Seeded legacy demo tenant: orders=${result.replenishmentOrderCount} ` +
      `containers=${result.containerCount} skus=${result.productSkuCount}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
