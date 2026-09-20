import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { normalizeRegisterProductSkuCommand } from "../apps/api/src/modules/master-data/domain/product-sku.js";
import { PrismaProductSkuRepository } from "../apps/api/src/modules/master-data/infrastructure/prisma-product-sku.repository.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260920210000_add_product_sku_master";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-sku-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);

      const legacy = createPrisma(targetUrl);
      const orderId = randomUUID();
      try {
        await legacy.replenishmentOrder.create({
          data: {
            id: orderId,
            tenantId: "legacy-tenant",
            orderNumber: "LEGACY-ORDER",
          },
        });
        await legacy.replenishmentOrderLine.create({
          data: {
            replenishmentOrderId: orderId,
            productNumber: "LEGACY-SKU",
            shippedQuantity: "1",
            quantityUnit: "piece",
            sourceBatchId: randomUUID(),
            sourceRowId: "row-1",
          },
        });
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);

      const upgraded = createPrisma(targetUrl);
      try {
        await assertProductSkuSchema(upgraded);
        const [legacyLines, guessedSkus] = await Promise.all([
          upgraded.replenishmentOrderLine.count({
            where: { productNumber: "LEGACY-SKU" },
          }),
          upgraded.productSku.count(),
        ]);
        if (legacyLines !== 1 || guessedSkus !== 0) {
          throw new Error(
            `SKU migration rewrote legacy facts: ${legacyLines},${guessedSkus}`,
          );
        }
      } finally {
        await upgraded.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Product SKU master verified: existing data upgrade preserved legacy lines without guessed identities.",
  );
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const target = createPrisma(targetUrl);
    try {
      await assertProductSkuSchema(target);
      await assertRegistrationSemantics(target);
      await assertDatabaseConstraints(target);
    } finally {
      await target.$disconnect();
    }
  });
  console.log(
    "Product SKU master verified: empty migration, idempotency, uniqueness and tenant isolation passed.",
  );
}

async function assertProductSkuSchema(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      skuTable: string | null;
      registrationTable: string | null;
      skuUnique: string | null;
      registrationUnique: string | null;
      tenantForeignKey: string | null;
    }>
  >`
    SELECT
      to_regclass('public.product_sku')::text AS "skuTable",
      to_regclass('public.product_sku_registration')::text AS "registrationTable",
      to_regclass('public.product_sku_tenant_number_key')::text AS "skuUnique",
      to_regclass('public.product_sku_registration_tenant_key')::text AS "registrationUnique",
      (
        SELECT conname
        FROM pg_constraint
        WHERE conname = 'product_sku_registration_product_fkey'
      ) AS "tenantForeignKey"
  `;
  const row = rows[0];
  if (
    row?.skuTable !== "product_sku" ||
    row.registrationTable !== "product_sku_registration" ||
    row.skuUnique !== "product_sku_tenant_number_key" ||
    row.registrationUnique !== "product_sku_registration_tenant_key" ||
    row.tenantForeignKey !== "product_sku_registration_product_fkey"
  ) {
    throw new Error("Product SKU schema verification failed");
  }
}

async function assertRegistrationSemantics(
  prisma: PrismaClient,
): Promise<void> {
  const repository = new PrismaProductSkuRepository(prisma as never);
  const command = normalizeRegisterProductSkuCommand({
    tenantId: "tenant-a",
    productNumber: "SKU-1",
    idempotencyKey: "verification:sku-1",
  });
  const first = await repository.register(command);
  const replay = await repository.register(command);
  if (
    first.duplicate ||
    !replay.duplicate ||
    first.record.productSkuId !== replay.record.productSkuId
  ) {
    throw new Error("Product SKU idempotent replay failed");
  }

  let conflictRejected = false;
  try {
    await repository.register({
      ...normalizeRegisterProductSkuCommand({
        tenantId: "tenant-a",
        productNumber: "SKU-2",
        idempotencyKey: "verification:sku-1",
      }),
    });
  } catch (error) {
    conflictRejected =
      error instanceof Error &&
      error.message === "MASTER_DATA_IDEMPOTENCY_CONFLICT";
  }
  if (!conflictRejected) {
    throw new Error("Product SKU idempotency conflict was accepted");
  }

  const otherTenant = await repository.register(
    normalizeRegisterProductSkuCommand({
      tenantId: "tenant-b",
      productNumber: "SKU-1",
      idempotencyKey: "verification:sku-1",
    }),
  );
  if (otherTenant.record.productSkuId === first.record.productSkuId) {
    throw new Error("Product SKU identity leaked across tenants");
  }
}

async function assertDatabaseConstraints(prisma: PrismaClient): Promise<void> {
  let whitespaceRejected = false;
  try {
    await prisma.productSku.create({
      data: {
        tenantId: "tenant-a",
        productNumber: " SKU-WHITESPACE",
      },
    });
  } catch {
    whitespaceRejected = true;
  }
  if (!whitespaceRejected) {
    throw new Error("Product SKU whitespace constraint was not enforced");
  }

  let controlCharacterRejected = false;
  try {
    await prisma.productSku.create({
      data: {
        tenantId: "tenant-a",
        productNumber: "SKU-CONTROL\n",
      },
    });
  } catch {
    controlCharacterRejected = true;
  }
  if (!controlCharacterRejected) {
    throw new Error(
      "Product SKU control character constraint was not enforced",
    );
  }

  const tenantASku = await prisma.productSku.findUniqueOrThrow({
    where: {
      tenantId_productNumber: {
        tenantId: "tenant-a",
        productNumber: "SKU-1",
      },
    },
  });
  let crossTenantReferenceRejected = false;
  try {
    await prisma.productSkuRegistration.create({
      data: {
        tenantId: "tenant-b",
        idempotencyKey: "verification:cross-tenant",
        payloadHash: "c".repeat(64),
        productSkuId: tenantASku.id,
      },
    });
  } catch {
    crossTenantReferenceRejected = true;
  }
  if (!crossTenantReferenceRejected) {
    throw new Error("Cross-tenant Product SKU registration was accepted");
  }
}

async function withTemporaryDatabase(
  source: string,
  suffix: string,
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_sku_${suffix}_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_sku_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)) {
    throw new Error("Unsafe temporary database name");
  }

  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${databaseName}`;
  targetUrl.searchParams.set("schema", "public");

  const admin = createPrisma(adminUrl.toString());
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await verify(targetUrl.toString());
  } finally {
    if (created) {
      await admin.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await admin.$disconnect();
  }
}

function prepareLegacyMigrationFixture(fixtureRoot: string): string {
  const sourceRoot = resolve("database/migrations");
  const migrationRoot = join(fixtureRoot, "migrations");
  mkdirSync(migrationRoot);
  copyFileSync(
    join(sourceRoot, "migration_lock.toml"),
    join(migrationRoot, "migration_lock.toml"),
  );
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      /^\d{14}_/.test(entry.name) &&
      entry.name < targetMigration
    ) {
      cpSync(join(sourceRoot, entry.name), join(migrationRoot, entry.name), {
        recursive: true,
      });
    }
  }

  const configPath = join(fixtureRoot, "prisma.config.mjs");
  const prismaConfigUrl = pathToFileURL(require.resolve("prisma/config")).href;
  writeFileSync(
    configPath,
    `import { defineConfig } from ${JSON.stringify(prismaConfigUrl)};\n\nexport default defineConfig({\n  schema: ${JSON.stringify(resolve("database/schema.prisma"))},\n  datasource: { url: process.env.DATABASE_URL },\n  migrations: { path: ${JSON.stringify(migrationRoot)} },\n});\n`,
  );
  return configPath;
}

function deployLegacyMigrations(configPath: string, url: string): void {
  const deploy = () =>
    runPrisma(["migrate", "deploy", "--config", configPath], url);
  const firstAttempt = deploy();
  if (firstAttempt.status === 0) return;

  const output = `${firstAttempt.stdout ?? ""}\n${firstAttempt.stderr ?? ""}`;
  if (!isKnownEmptyDatabaseFailure(output)) {
    throw new Error(`Legacy migration fixture failed:\n${output}`);
  }
  const resolved = runPrisma(
    [
      "migrate",
      "resolve",
      "--applied",
      "20260913011044_inbox",
      "--config",
      configPath,
    ],
    url,
  );
  if (resolved.status !== 0) {
    throw new Error(
      `Legacy migration recovery failed:\n${resolved.stdout ?? ""}\n${resolved.stderr ?? ""}`,
    );
  }
  const retry = deploy();
  if (retry.status !== 0) {
    throw new Error(
      `Legacy migration retry failed:\n${retry.stdout ?? ""}\n${retry.stderr ?? ""}`,
    );
  }
}

function deployCurrentMigrations(url: string): void {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error("npm_execpath is required to run migrations");
  const migration = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
  if (migration.status !== 0) {
    throw new Error(
      `Database migration failed:\n${migration.stdout ?? ""}\n${migration.stderr ?? ""}`,
    );
  }
}

function runPrisma(args: string[], url: string) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
