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
import { normalizeContainerStuffingSnapshotCommand } from "../apps/api/src/modules/shipment-registry/domain/container-stuffing-snapshot.js";
import { PrismaContainerStuffingSnapshotRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container-stuffing-snapshot.repository.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260921030000_add_container_stuffing_snapshots";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-stuffing-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      const legacy = createPrisma(targetUrl);
      const tenantId = "legacy-tenant";
      const containerRecordId = randomUUID();
      const allocationSetId = randomUUID();
      try {
        await legacy.containerRecord.create({
          data: {
            id: containerRecordId,
            tenantId,
            orderNumber: "LEGACY-STUFFING",
            currentStatus: "not_shipped",
          },
        });
        await legacy.containerCargoAllocationSet.create({
          data: allocationSet({
            id: allocationSetId,
            tenantId,
            containerRecordId,
            idempotencyKey: "legacy-stuffing-allocation",
          }),
        });
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);
      const upgraded = createPrisma(targetUrl);
      try {
        await assertSchema(upgraded);
        const [container, allocation, snapshots] = await Promise.all([
          upgraded.containerRecord.findUnique({
            where: { id: containerRecordId },
          }),
          upgraded.containerCargoAllocationSet.findUnique({
            where: { id: allocationSetId },
          }),
          upgraded.containerStuffingSnapshot.count(),
        ]);
        if (!container || !allocation || snapshots !== 0) {
          throw new Error("Stuffing migration changed existing shipment data");
        }
      } finally {
        await upgraded.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Container stuffing upgrade verified: existing containers and allocations were preserved.",
  );
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const prisma = createPrisma(targetUrl);
    try {
      await assertSchema(prisma);
      const tenantId = "tenant-a";
      const firstContainerId = randomUUID();
      const secondContainerId = randomUUID();
      const firstAllocationId = randomUUID();
      const secondAllocationId = randomUUID();
      await prisma.containerRecord.createMany({
        data: [
          {
            id: firstContainerId,
            tenantId,
            orderNumber: "STUFFING-1",
            currentStatus: "not_shipped",
          },
          {
            id: secondContainerId,
            tenantId,
            orderNumber: "STUFFING-2",
            currentStatus: "not_shipped",
          },
        ],
      });
      await prisma.containerCargoAllocationSet.createMany({
        data: [
          allocationSet({
            id: firstAllocationId,
            tenantId,
            containerRecordId: firstContainerId,
            idempotencyKey: "stuffing-allocation-1",
          }),
          allocationSet({
            id: secondAllocationId,
            tenantId,
            containerRecordId: secondContainerId,
            idempotencyKey: "stuffing-allocation-2",
          }),
        ],
      });

      const repository = new PrismaContainerStuffingSnapshotRepository(
        prisma as never,
      );
      const firstCommand = stuffingCommand({
        tenantId,
        containerRecordId: firstContainerId,
        allocationSetId: firstAllocationId,
        expectedVersion: 0,
        sealNumber: "SEAL-1",
        idempotencyKey: "stuffing-snapshot-1",
      });
      const first = await repository.replace(firstCommand);
      const replay = await repository.replace(firstCommand);
      if (
        first.version !== 1 ||
        first.duplicate ||
        replay.snapshotId !== first.snapshotId ||
        !replay.duplicate
      ) {
        throw new Error("Stuffing snapshot idempotency failed");
      }

      const corrected = await repository.replace(
        stuffingCommand({
          tenantId,
          containerRecordId: firstContainerId,
          allocationSetId: firstAllocationId,
          expectedVersion: 1,
          sealNumber: "SEAL-2",
          idempotencyKey: "stuffing-snapshot-2",
        }),
      );
      const versions = await prisma.containerStuffingSnapshot.findMany({
        where: { tenantId, containerRecordId: firstContainerId },
        orderBy: { version: "asc" },
        select: {
          id: true,
          version: true,
          state: true,
          supersedesSnapshotId: true,
        },
      });
      const boundContainer = await prisma.containerRecord.findUniqueOrThrow({
        where: { id: firstContainerId },
        select: { containerNumber: true },
      });
      if (
        corrected.version !== 2 ||
        versions.length !== 2 ||
        versions[0]?.state !== "superseded" ||
        versions[1]?.state !== "active" ||
        versions[1]?.supersedesSnapshotId !== first.snapshotId ||
        boundContainer.containerNumber !== "KOCU4960726"
      ) {
        throw new Error(
          "Stuffing snapshot version chain or identity binding failed",
        );
      }

      await expectDatabaseRejection(
        () =>
          prisma.containerStuffingSnapshot.create({
            data: rawSnapshot({
              tenantId,
              containerRecordId: secondContainerId,
              allocationSetId: firstAllocationId,
              version: 1,
              idempotencyKey: "cross-container-allocation",
            }),
          }),
        "Cross-container allocation reference was accepted",
      );
      await expectDatabaseRejection(
        () =>
          prisma.containerStuffingSnapshot.create({
            data: rawSnapshot({
              tenantId,
              containerRecordId: firstContainerId,
              allocationSetId: firstAllocationId,
              version: 3,
              idempotencyKey: "second-active-snapshot",
            }),
          }),
        "A second active stuffing snapshot was accepted",
      );
      await expectDatabaseRejection(
        () =>
          prisma.containerStuffingSnapshot.create({
            data: {
              ...rawSnapshot({
                tenantId,
                containerRecordId: secondContainerId,
                allocationSetId: secondAllocationId,
                version: 1,
                idempotencyKey: "invalid-vgm",
              }),
              vgmWeight: "900",
              vgmWeightUnit: "KGM",
              vgmMethod: "method_1",
              vgmVerifiedAt: new Date("2026-01-23T01:00:00.000Z"),
            },
          }),
        "VGM below gross weight was accepted",
      );
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log(
    "Container stuffing verified: empty migration, append-only corrections, idempotency, one-active, scoped allocation and VGM constraints passed.",
  );
}

function allocationSet(input: {
  id: string;
  tenantId: string;
  containerRecordId: string;
  idempotencyKey: string;
}) {
  return {
    ...input,
    version: 1,
    state: "active",
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: [randomUUID()],
    payloadHash: "a".repeat(64),
  };
}

function stuffingCommand(input: {
  tenantId: string;
  containerRecordId: string;
  allocationSetId: string;
  expectedVersion: number;
  sealNumber: string;
  idempotencyKey: string;
}) {
  return normalizeContainerStuffingSnapshotCommand({
    ...input,
    allocationSetVersion: 1,
    containerNumber: "KOCU4960726",
    packageCount: 524,
    grossWeight: "1000",
    grossWeightUnit: "KGM",
    netWeight: "900",
    volume: "66.74",
    volumeUnit: "MTQ",
    vgm: null,
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
    actorId: "verification-operator",
    reasonCode: "stuffing_confirmed",
  });
}

function rawSnapshot(input: {
  tenantId: string;
  containerRecordId: string;
  allocationSetId: string;
  version: number;
  idempotencyKey: string;
}) {
  return {
    id: randomUUID(),
    ...input,
    state: "active",
    allocationSetVersion: 1,
    containerNumber: "KOCU4960726",
    sealNumber: "SEAL-RAW",
    packageCount: 1,
    grossWeight: "1000",
    grossWeightUnit: "KGM",
    netWeight: "900",
    volume: "1",
    volumeUnit: "MTQ",
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: [randomUUID()],
    actorId: "verification-operator",
    reasonCode: "constraint_probe",
    payloadHash: "b".repeat(64),
  };
}

async function expectDatabaseRejection(
  operation: () => Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(message);
}

async function assertSchema(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      snapshotTable: string | null;
      oneActiveIndex: string | null;
      allocationScopeIndex: string | null;
    }>
  >`
    SELECT
      to_regclass('public.container_stuffing_snapshot')::text AS "snapshotTable",
      to_regclass('public.container_stuffing_snapshot_one_active_key')::text AS "oneActiveIndex",
      to_regclass('public.container_cargo_set_id_scope_key')::text AS "allocationScopeIndex"
  `;
  const row = rows[0];
  if (
    row?.snapshotTable !== "container_stuffing_snapshot" ||
    row.oneActiveIndex !== "container_stuffing_snapshot_one_active_key" ||
    row.allocationScopeIndex !== "container_cargo_set_id_scope_key"
  ) {
    throw new Error("Container stuffing schema verification failed");
  }
}

async function withTemporaryDatabase(
  source: string,
  suffix: "upgrade" | "empty",
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_stuffing_${suffix}_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_stuffing_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)) {
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
      `Database migration failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
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
