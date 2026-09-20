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
import { normalizeReplaceContainerCargoAllocationsCommand } from "../apps/api/src/modules/shipment-registry/domain/container-cargo-allocation.js";
import { PrismaContainerCargoAllocationRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container-cargo-allocation.repository.js";
import { PrismaReplenishmentLineSkuBinder } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-replenishment-line-sku-binder.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260920213000_add_shipment_cargo_allocation";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-cargo-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      const legacy = createPrisma(targetUrl);
      const orderId = randomUUID();
      const lineId = randomUUID();
      try {
        await legacy.$executeRaw`
          INSERT INTO "replenishment_order" (
            "id", "tenant_id", "order_number", "created_at", "updated_at"
          ) VALUES (
            ${orderId}, 'legacy-tenant', 'LEGACY-CARGO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        await legacy.$executeRaw`
          INSERT INTO "replenishment_order_line" (
            "id", "replenishment_order_id", "product_number",
            "shipped_quantity", "quantity_unit", "source_batch_id",
            "source_row_id", "is_current", "created_at", "updated_at"
          ) VALUES (
            ${lineId}, ${orderId}, 'LEGACY-SKU', 2, 'piece',
            ${randomUUID()}, 'row-1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);
      const upgraded = createPrisma(targetUrl);
      try {
        const line = await upgraded.replenishmentOrderLine.findUniqueOrThrow({
          where: { id: lineId },
        });
        if (
          line.tenantId !== "legacy-tenant" ||
          line.productSkuId !== null ||
          line.version !== 1
        ) {
          throw new Error(
            "Cargo allocation migration guessed or lost line data",
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
    "Shipment cargo allocation verified: legacy line tenant backfilled without guessed SKU identity.",
  );
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const prisma = createPrisma(targetUrl);
    try {
      const tenantId = "tenant-a";
      const orderId = randomUUID();
      const secondOrderId = randomUUID();
      const lineId = randomUUID();
      const secondLineId = randomUUID();
      const productSkuId = randomUUID();
      const secondProductSkuId = randomUUID();
      const firstContainerId = randomUUID();
      const secondContainerId = randomUUID();
      const thirdContainerId = randomUUID();
      await prisma.productSku.createMany({
        data: [
          { id: productSkuId, tenantId, productNumber: "SKU-1" },
          {
            id: secondProductSkuId,
            tenantId,
            productNumber: "SKU-2",
          },
        ],
      });
      await prisma.replenishmentOrder.createMany({
        data: [
          { id: orderId, tenantId, orderNumber: "ORDER-1" },
          { id: secondOrderId, tenantId, orderNumber: "ORDER-2" },
        ],
      });
      await prisma.replenishmentOrderLine.createMany({
        data: [
          {
            id: lineId,
            tenantId,
            replenishmentOrderId: orderId,
            productNumber: "SKU-1",
            shippedQuantity: "10",
            quantityUnit: "piece",
            sourceBatchId: randomUUID(),
            sourceRowId: "row-1",
          },
          {
            id: secondLineId,
            tenantId,
            replenishmentOrderId: secondOrderId,
            productNumber: "SKU-2",
            shippedQuantity: "3",
            quantityUnit: "piece",
            sourceBatchId: randomUUID(),
            sourceRowId: "row-2",
          },
        ],
      });
      await prisma.containerRecord.createMany({
        data: [
          {
            id: firstContainerId,
            tenantId,
            orderNumber: "ORDER-1",
            replenishmentOrderId: orderId,
            currentStatus: "not_shipped",
          },
          {
            id: secondContainerId,
            tenantId,
            orderNumber: "ORDER-2",
            currentStatus: "not_shipped",
          },
          {
            id: thirdContainerId,
            tenantId,
            orderNumber: "ORDER-3",
            currentStatus: "not_shipped",
          },
        ],
      });

      const binder = new PrismaReplenishmentLineSkuBinder(prisma as never);
      const bound = await binder.bind({
        tenantId,
        replenishmentOrderLineId: lineId,
        productSkuId,
        productNumber: "SKU-1",
        expectedVersion: 1,
      });
      if (bound.version !== 2 || bound.duplicate) {
        throw new Error("Shipment line SKU binding failed");
      }
      const replay = await binder.bind({
        tenantId,
        replenishmentOrderLineId: lineId,
        productSkuId,
        productNumber: "SKU-1",
        expectedVersion: 1,
      });
      if (!replay.duplicate || replay.version !== 2) {
        throw new Error("Shipment line SKU binding replay failed");
      }
      await binder.bind({
        tenantId,
        replenishmentOrderLineId: secondLineId,
        productSkuId: secondProductSkuId,
        productNumber: "SKU-2",
        expectedVersion: 1,
      });

      const repository = new PrismaContainerCargoAllocationRepository(
        prisma as never,
      );
      const firstCommand = normalizeReplaceContainerCargoAllocationsCommand({
        tenantId,
        containerRecordId: firstContainerId,
        expectedVersion: 0,
        ingestionChannel: "file_import",
        sourceSystem: "verification",
        evidenceRefs: ["99999999-9999-4999-8999-999999999999"],
        idempotencyKey: "verification:cargo:first:v1",
        allocations: [
          {
            replenishmentOrderLineId: lineId,
            allocatedQuantity: "5",
            quantityUnit: "piece",
          },
          {
            replenishmentOrderLineId: secondLineId,
            allocatedQuantity: "3",
            quantityUnit: "piece",
          },
        ],
      });
      const first = await repository.replace(firstCommand);
      const firstReplay = await repository.replace(firstCommand);
      if (
        first.version !== 1 ||
        first.allocationCount !== 2 ||
        firstReplay.allocationSetId !== first.allocationSetId ||
        !firstReplay.duplicate
      ) {
        throw new Error("Multi-order cargo allocation or replay failed");
      }

      const second = await repository.replace(
        allocationCommand({
          tenantId,
          containerRecordId: secondContainerId,
          lineId,
          quantity: "5",
          expectedVersion: 0,
          idempotencyKey: "verification:cargo:second:v1",
        }),
      );
      if (second.version !== 1) {
        throw new Error("Split cargo allocation failed");
      }

      let overAllocationRejected = false;
      try {
        await repository.replace(
          allocationCommand({
            tenantId,
            containerRecordId: secondContainerId,
            lineId,
            quantity: "6",
            expectedVersion: 1,
            idempotencyKey: "verification:cargo:second:v2-over",
          }),
        );
      } catch (error) {
        overAllocationRejected =
          error instanceof Error &&
          error.message === "CARGO_ALLOCATION_EXCEEDS_SHIPPED_QUANTITY";
      }
      if (!overAllocationRejected) {
        throw new Error("Cross-container over-allocation was accepted");
      }

      const corrected = await repository.replace(
        allocationCommand({
          tenantId,
          containerRecordId: secondContainerId,
          lineId,
          quantity: "4",
          expectedVersion: 1,
          idempotencyKey: "verification:cargo:second:v2",
        }),
      );
      const states = await prisma.containerCargoAllocationSet.findMany({
        where: { tenantId, containerRecordId: secondContainerId },
        orderBy: { version: "asc" },
        select: { version: true, state: true, supersedesSetId: true },
      });
      if (
        corrected.version !== 2 ||
        states.length !== 2 ||
        states[0]?.state !== "superseded" ||
        states[1]?.state !== "active" ||
        states[1]?.supersedesSetId !== second.allocationSetId
      ) {
        throw new Error("Cargo allocation version history failed");
      }

      let crossTenantRejected = false;
      try {
        await prisma.containerCargoAllocationSet.create({
          data: {
            tenantId: "tenant-b",
            containerRecordId: firstContainerId,
            version: 99,
            state: "active",
            ingestionChannel: "manual_ui",
            sourceSystem: "verification",
            evidenceRefs: [randomUUID()],
            idempotencyKey: "verification:cross-tenant",
            payloadHash: "a".repeat(64),
          },
        });
      } catch {
        crossTenantRejected = true;
      }
      if (!crossTenantRejected) {
        throw new Error("Cross-tenant cargo allocation set was accepted");
      }

      const tenantBContainerId = randomUUID();
      const tenantBSetId = randomUUID();
      await prisma.containerRecord.create({
        data: {
          id: tenantBContainerId,
          tenantId: "tenant-b",
          orderNumber: "ORDER-B",
          currentStatus: "not_shipped",
        },
      });
      await prisma.containerCargoAllocationSet.create({
        data: {
          id: tenantBSetId,
          tenantId: "tenant-b",
          containerRecordId: tenantBContainerId,
          version: 1,
          state: "active",
          ingestionChannel: "manual_ui",
          sourceSystem: "verification",
          evidenceRefs: [randomUUID()],
          idempotencyKey: "verification:tenant-b:v1",
          payloadHash: "b".repeat(64),
        },
      });
      let crossTenantSupersessionRejected = false;
      try {
        await prisma.containerCargoAllocationSet.create({
          data: {
            tenantId,
            containerRecordId: thirdContainerId,
            version: 2,
            state: "active",
            supersedesSetId: tenantBSetId,
            ingestionChannel: "manual_ui",
            sourceSystem: "verification",
            evidenceRefs: [randomUUID()],
            idempotencyKey: "verification:cross-tenant-supersession",
            payloadHash: "c".repeat(64),
          },
        });
      } catch {
        crossTenantSupersessionRejected = true;
      }
      if (!crossTenantSupersessionRejected) {
        throw new Error("Cross-tenant cargo supersession was accepted");
      }
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log(
    "Shipment cargo allocation verified: empty migration, SKU binding, multi-order loading, split allocation, versioning and tenant constraints passed.",
  );
}

function allocationCommand(input: {
  tenantId: string;
  containerRecordId: string;
  lineId: string;
  quantity: string;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  return normalizeReplaceContainerCargoAllocationsCommand({
    tenantId: input.tenantId,
    containerRecordId: input.containerRecordId,
    expectedVersion: input.expectedVersion,
    ingestionChannel: "file_import",
    sourceSystem: "verification",
    evidenceRefs: ["99999999-9999-4999-8999-999999999999"],
    idempotencyKey: input.idempotencyKey,
    allocations: [
      {
        replenishmentOrderLineId: input.lineId,
        allocatedQuantity: input.quantity,
        quantityUnit: "piece",
      },
    ],
  });
}

async function withTemporaryDatabase(
  source: string,
  suffix: string,
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_cargo_${suffix}_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_cargo_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)) {
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
  const result = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `Database migration failed:\n${result.stdout}\n${result.stderr}`,
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
