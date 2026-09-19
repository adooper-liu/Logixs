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
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260920090000_add_evidence_registration_idempotency";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-evidence-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);

      const legacyId = randomUUID();
      const legacy = createPrisma(targetUrl);
      try {
        await legacy.$executeRaw`
          INSERT INTO "evidence_record" (
            "id",
            "tenant_id",
            "evidence_type",
            "subject_type",
            "subject_id",
            "authority_level",
            "content_ref",
            "content_hash",
            "source",
            "verification_state",
            "confidence_state",
            "validity",
            "received_at",
            "recorded_at",
            "updated_at"
          ) VALUES (
            ${legacyId},
            'verification-tenant',
            'api_response',
            'container',
            ${randomUUID()},
            'contextual',
            'verification://legacy-evidence',
            ${"a".repeat(64)},
            ${JSON.stringify({
              sourceId: randomUUID(),
              sourceType: "system",
              originatorSystem: "trackingeyes",
              authoritySystem: "unresolved",
              ingestionChannel: "webhook",
              captureSource: "external_evidence",
            })}::jsonb,
            'pending',
            'unknown',
            'effective',
            NOW(),
            NOW(),
            NOW()
          )
        `;
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);

      const upgraded = createPrisma(targetUrl);
      try {
        await assertEvidenceIdempotencySchema(upgraded);
        const row = await upgraded.evidenceRecord.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: "verification-tenant",
              idempotencyKey: `legacy:${legacyId}`,
            },
          },
        });
        if (row?.id !== legacyId) {
          throw new Error("Legacy Evidence idempotency backfill failed");
        }
        await assertTenantScopedUniqueness(upgraded);
      } finally {
        await upgraded.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Evidence idempotency verified: existing data upgrade and tenant-scoped uniqueness passed.",
  );
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    const target = createPrisma(targetUrl);
    try {
      await assertEvidenceIdempotencySchema(target);
    } finally {
      await target.$disconnect();
    }
  });
  console.log(
    "Evidence idempotency verified: empty database migration chain passed.",
  );
}

async function assertEvidenceIdempotencySchema(
  prisma: PrismaClient,
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      nullable: string | null;
      checkConstraint: string | null;
      uniqueIndex: string | null;
    }>
  >`
    SELECT
      (
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'evidence_record'
          AND column_name = 'idempotency_key'
      ) AS "nullable",
      (
        SELECT conname
        FROM pg_constraint
        WHERE conname = 'evidence_record_idempotency_key_check'
      ) AS "checkConstraint",
      to_regclass('public.evidence_record_tenant_idempotency_key')::text
        AS "uniqueIndex"
  `;
  if (
    rows[0]?.nullable !== "NO" ||
    rows[0]?.checkConstraint !== "evidence_record_idempotency_key_check" ||
    rows[0]?.uniqueIndex !== "evidence_record_tenant_idempotency_key"
  ) {
    throw new Error("Evidence idempotency migration verification failed");
  }
}

async function assertTenantScopedUniqueness(
  prisma: PrismaClient,
): Promise<void> {
  const idempotencyKey = `verification:${randomUUID()}`;
  const record = evidenceData("verification-tenant-a", idempotencyKey);
  await prisma.evidenceRecord.create({ data: record });
  await prisma.evidenceRecord.create({
    data: evidenceData("verification-tenant-b", idempotencyKey),
  });

  let rejectedDuplicate = false;
  try {
    await prisma.evidenceRecord.create({ data: record });
  } catch {
    rejectedDuplicate = true;
  }
  if (!rejectedDuplicate) {
    throw new Error("Evidence tenant idempotency uniqueness was not enforced");
  }
}

function evidenceData(tenantId: string, idempotencyKey: string) {
  const now = new Date();
  return {
    id: randomUUID(),
    tenantId,
    idempotencyKey,
    evidenceType: "api_response",
    subjectType: "container",
    subjectId: randomUUID(),
    authorityLevel: "contextual",
    contentRef: `verification://${randomUUID()}`,
    contentHash: "b".repeat(64),
    source: {
      sourceId: randomUUID(),
      sourceType: "system",
      originatorSystem: "trackingeyes",
      authoritySystem: "unresolved",
      ingestionChannel: "webhook",
      captureSource: "external_evidence",
    },
    verificationState: "pending",
    confidenceState: "unknown",
    validity: "effective",
    receivedAt: now,
    recordedAt: now,
    updatedAt: now,
  };
}

async function withTemporaryDatabase(
  source: string,
  suffix: string,
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_evidence_${suffix}_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_evidence_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)) {
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
