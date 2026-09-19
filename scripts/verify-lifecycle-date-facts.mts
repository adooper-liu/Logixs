import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
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
const firstTargetMigration = "20260918170000_add_lifecycle_date_facts";
const targetMigrationPaths = [
  "database/migrations/20260918170000_add_lifecycle_date_facts/migration.sql",
  "database/migrations/20260918183000_add_source_authority_and_application_leases/migration.sql",
  "database/migrations/20260918200000_add_node_event_applications/migration.sql",
  "database/migrations/20260919100000_add_canonical_event_fact_context/migration.sql",
];
const migrationSql = targetMigrationPaths.map((path) =>
  readFileSync(path, "utf8"),
);
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyUpgradeRollback(connectionString);
await verifyEmptyDatabaseMigration(connectionString);

async function verifyUpgradeRollback(url: string): Promise<void> {
  const sourceUrl = new URL(url);
  const databaseName = `logix_verify_date_facts_upgrade_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_date_facts_upgrade_[0-9_]+$/.test(databaseName)) {
    throw new Error("Unsafe temporary database name");
  }

  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${databaseName}`;
  targetUrl.searchParams.set("schema", "public");

  const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-date-facts-upgrade-"));
  const configPath = prepareLegacyMigrationFixture(fixtureRoot);
  const admin = createPrisma(adminUrl.toString());
  let created = false;
  const rollback = new Error("EXPECTED_VERIFICATION_ROLLBACK");
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    deployLegacyMigrations(configPath, targetUrl.toString());

    const target = createPrisma(targetUrl.toString());
    try {
      try {
        await target.$transaction(async (transaction) => {
          for (const sql of migrationSql) {
            await transaction.$executeRawUnsafe(sql);
          }
          await assertLifecycleDateFactSchema(transaction);
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    } finally {
      await target.$disconnect();
    }
  } finally {
    if (created) {
      await admin.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await admin.$disconnect();
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
  console.log(
    "Lifecycle date facts verified: existing database upgrade passed and was rolled back.",
  );
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
      entry.name < firstTargetMigration
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

function runPrisma(args: string[], url: string) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function verifyEmptyDatabaseMigration(url: string): Promise<void> {
  const sourceUrl = new URL(url);
  const databaseName = `logix_verify_date_facts_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_date_facts_[0-9_]+$/.test(databaseName)) {
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
    const pnpmCli = process.env.npm_execpath;
    if (!pnpmCli) throw new Error("npm_execpath is required to run migrations");
    const migration = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: targetUrl.toString() },
      encoding: "utf8",
      stdio: "pipe",
    });
    if (migration.status !== 0) {
      throw new Error(
        `Empty database migration failed:\n${migration.stdout}\n${migration.stderr}`,
      );
    }

    const target = createPrisma(targetUrl.toString());
    try {
      await assertLifecycleDateFactSchema(target);
    } finally {
      await target.$disconnect();
    }
    console.log(
      "Lifecycle date facts verified: empty database migration chain passed.",
    );
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

async function assertLifecycleDateFactSchema(
  prisma: Pick<PrismaClient, "$queryRaw">,
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      dateFactTable: string | null;
      policyTable: string | null;
      nodeApplicationTable: string | null;
      constraintCount: bigint;
      nodeApplicationConstraintCount: bigint;
      canonicalEventConstraintCount: bigint;
      canonicalEventContextColumnCount: bigint;
      leaseColumnCount: bigint;
      pendingClaimIndex: string | null;
      nodeApplicationIndex: string | null;
      canonicalEventFactIndex: string | null;
    }>
  >`
    SELECT
      to_regclass('public.lifecycle_date_fact')::text AS "dateFactTable",
      to_regclass('public.source_authority_policy')::text AS "policyTable",
      to_regclass('public.node_event_application')::text AS "nodeApplicationTable",
      COUNT(*) FILTER (
        WHERE conname IN (
          'lifecycle_date_fact_container_id_fkey',
          'lifecycle_date_fact_supersedes_fact_id_fkey',
          'lifecycle_date_fact_canonical_event_id_fkey',
          'lifecycle_date_fact_application_attempts_check',
          'source_authority_policy_version_check',
          'source_authority_policy_effective_check',
          'source_authority_policy_target_check',
          'source_authority_policy_time_kind_check',
          'source_authority_policy_level_check',
          'source_authority_policy_conflict_check',
          'source_authority_policy_arrays_check'
        )
      ) AS "constraintCount",
      COUNT(*) FILTER (
        WHERE conname IN (
          'node_event_application_event_id_fkey',
          'node_event_application_target_node_instance_id_fkey',
          'node_event_application_state_check',
          'node_event_application_guards_check',
          'node_event_application_reason_check'
        )
      ) AS "nodeApplicationConstraintCount",
      COUNT(*) FILTER (
        WHERE conname IN (
          'canonical_event_fact_context_check',
          'canonical_event_domain_fact_id_fkey'
        )
      ) AS "canonicalEventConstraintCount",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'canonical_event'
          AND column_name IN (
            'domain_fact_id',
            'node_code',
            'time_kind',
            'authority_policy_ref'
          )
      ) AS "canonicalEventContextColumnCount",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lifecycle_date_fact'
          AND column_name IN (
            'application_lease_owner',
            'application_lease_until',
            'application_attempts',
            'last_application_at'
          )
      ) AS "leaseColumnCount",
      to_regclass('public.lifecycle_date_fact_pending_claim_idx')::text
        AS "pendingClaimIndex",
      to_regclass('public.node_event_application_target_state_idx')::text
        AS "nodeApplicationIndex",
      to_regclass('public.canonical_event_domain_fact_key')::text
        AS "canonicalEventFactIndex"
    FROM pg_constraint
  `;
  if (
    rows[0]?.dateFactTable !== "lifecycle_date_fact" ||
    rows[0]?.policyTable !== "source_authority_policy" ||
    rows[0]?.nodeApplicationTable !== "node_event_application" ||
    Number(rows[0]?.constraintCount ?? 0) !== 11 ||
    Number(rows[0]?.nodeApplicationConstraintCount ?? 0) !== 5 ||
    Number(rows[0]?.canonicalEventConstraintCount ?? 0) !== 2 ||
    Number(rows[0]?.canonicalEventContextColumnCount ?? 0) !== 4 ||
    Number(rows[0]?.leaseColumnCount ?? 0) !== 4 ||
    rows[0]?.pendingClaimIndex !== "lifecycle_date_fact_pending_claim_idx" ||
    rows[0]?.nodeApplicationIndex !==
      "node_event_application_target_state_idx" ||
    rows[0]?.canonicalEventFactIndex !== "canonical_event_domain_fact_key"
  ) {
    throw new Error("Lifecycle date fact migration verification failed");
  }
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
