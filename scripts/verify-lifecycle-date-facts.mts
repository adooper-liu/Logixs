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
  "database/migrations/20260920120000_add_lifecycle_node_blocks/migration.sql",
  "database/migrations/20260920150000_add_lifecycle_location_context/migration.sql",
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
          await assertNodeBlockPersistence(transaction);
          await assertLifecycleLocationPersistence(transaction);
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
      await assertNodeBlockPersistence(target);
      await assertLifecycleLocationPersistence(target);
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
      locationContextColumnCount: bigint;
      locationContextConstraintCount: bigint;
      locationSlotIndex: string | null;
      nodeBlockTable: string | null;
      nodeBlockResolutionTable: string | null;
      nodeBlockConstraintCount: bigint;
      nodeBlockResolutionConstraintCount: bigint;
      nodeBlockIndexCount: bigint;
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
        AS "canonicalEventFactIndex",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('lifecycle_date_fact', 'canonical_event')
          AND column_name IN (
            'location_type',
            'unlocode',
            'location_id',
            'segment_id',
            'port_call_id',
            'location_timezone'
          )
      ) AS "locationContextColumnCount",
      COUNT(*) FILTER (
        WHERE conname IN (
          'lifecycle_date_fact_location_context_check',
          'canonical_event_location_context_check'
        )
      ) AS "locationContextConstraintCount",
      to_regclass('public.lifecycle_date_fact_segment_slot_idx')::text
        AS "locationSlotIndex",
      to_regclass('public.node_block')::text AS "nodeBlockTable",
      to_regclass('public.node_block_resolution')::text
        AS "nodeBlockResolutionTable",
      COUNT(*) FILTER (
        WHERE conname IN (
          'node_block_type_check',
          'node_block_actor_check',
          'node_block_idempotency_check',
          'node_block_trace_check',
          'node_block_projection_version_check',
          'node_block_flow_instance_id_fkey',
          'node_block_node_instance_id_fkey',
          'node_block_source_fact_id_fkey'
        )
      ) AS "nodeBlockConstraintCount",
      COUNT(*) FILTER (
        WHERE conname IN (
          'node_block_resolution_reason_check',
          'node_block_resolution_actor_check',
          'node_block_resolution_idempotency_check',
          'node_block_resolution_trace_check',
          'node_block_resolution_projection_version_check',
          'node_block_resolution_block_id_fkey'
        )
      ) AS "nodeBlockResolutionConstraintCount",
      (
        SELECT COUNT(*)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'node_block_tenant_idempotency_key',
            'node_block_flow_node_idx',
            'node_block_node_occurred_idx',
            'node_block_resolution_block_key',
            'node_block_resolution_tenant_idempotency_key'
          )
      ) AS "nodeBlockIndexCount"
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
    rows[0]?.canonicalEventFactIndex !== "canonical_event_domain_fact_key" ||
    Number(rows[0]?.locationContextColumnCount ?? 0) !== 12 ||
    Number(rows[0]?.locationContextConstraintCount ?? 0) !== 2 ||
    rows[0]?.locationSlotIndex !== "lifecycle_date_fact_segment_slot_idx" ||
    rows[0]?.nodeBlockTable !== "node_block" ||
    rows[0]?.nodeBlockResolutionTable !== "node_block_resolution" ||
    Number(rows[0]?.nodeBlockConstraintCount ?? 0) !== 8 ||
    Number(rows[0]?.nodeBlockResolutionConstraintCount ?? 0) !== 6 ||
    Number(rows[0]?.nodeBlockIndexCount ?? 0) !== 5
  ) {
    throw new Error("Lifecycle date fact migration verification failed");
  }
}

async function assertLifecycleLocationPersistence(
  prisma: Pick<PrismaClient, "$executeRawUnsafe" | "$queryRaw">,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $verify_location_fact$
    BEGIN
      BEGIN
        UPDATE "lifecycle_date_fact"
        SET "unlocode" = 'USLAX'
        WHERE "id" = '10000000-0000-4000-8000-000000000005';
        RAISE EXCEPTION 'location constraint accepted a partial fact context';
      EXCEPTION WHEN check_violation THEN
        NULL;
      END;
    END
    $verify_location_fact$;

    UPDATE "lifecycle_date_fact"
    SET
      "location_type" = 'port',
      "unlocode" = 'USLAX',
      "segment_id" = '10000000-0000-4000-8000-000000000010',
      "port_call_id" = 'verify-port-call-1',
      "location_timezone" = 'America/Los_Angeles'
    WHERE "id" = '10000000-0000-4000-8000-000000000005';

    INSERT INTO "canonical_event" (
      "id", "container_id", "event_code", "domain_fact_id", "node_code",
      "time_kind", "authority_policy_ref", "location_type", "unlocode",
      "segment_id", "port_call_id", "location_timezone", "occurred_at",
      "evidence_refs", "idempotency_key", "applied_at"
    ) VALUES (
      '10000000-0000-4000-8000-000000000011',
      '10000000-0000-4000-8000-000000000001', 'inspection',
      '10000000-0000-4000-8000-000000000005', 'customs_clearance', 'actual',
      'customs-inspection-v1', 'port', 'USLAX',
      '10000000-0000-4000-8000-000000000010', 'verify-port-call-1',
      'America/Los_Angeles', '2026-09-20T01:00:00Z',
      '["10000000-0000-4000-8000-000000000006"]'::jsonb,
      'verify-location-event-1', CURRENT_TIMESTAMP
    );

    DO $verify_location_event$
    BEGIN
      BEGIN
        UPDATE "canonical_event"
        SET "location_timezone" = NULL
        WHERE "id" = '10000000-0000-4000-8000-000000000011';
        RAISE EXCEPTION 'location constraint accepted a partial event context';
      EXCEPTION WHEN check_violation THEN
        NULL;
      END;
    END
    $verify_location_event$;
  `);
  const rows = await prisma.$queryRaw<Array<{ matchedCount: bigint }>>`
    SELECT COUNT(*) AS "matchedCount"
    FROM "canonical_event" e
    JOIN "lifecycle_date_fact" f ON f."id" = e."domain_fact_id"
    WHERE e."id" = '10000000-0000-4000-8000-000000000011'
      AND e."location_type" = f."location_type"
      AND e."unlocode" = f."unlocode"
      AND e."segment_id" = f."segment_id"
      AND e."port_call_id" = f."port_call_id"
      AND e."location_timezone" = f."location_timezone"
  `;
  if (Number(rows[0]?.matchedCount ?? 0) !== 1) {
    throw new Error("Lifecycle location persistence verification failed");
  }
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

async function assertNodeBlockPersistence(
  prisma: Pick<PrismaClient, "$executeRawUnsafe" | "$queryRaw">,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "container_record"
      ("id", "tenant_id", "order_number", "current_status", "created_at", "updated_at")
    VALUES
      ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'VERIFY-BLOCK-1', 'in_transit', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO "flow_instance"
      ("id", "container_id", "state", "current_node_code", "version", "created_at", "updated_at")
    VALUES
      ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'active', 'customs_clearance', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO "node_instance"
      ("id", "flow_instance_id", "node_code", "state", "applicability")
    VALUES
      ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'customs_clearance', 'blocked', 'required');

    INSERT INTO "lifecycle_date_fact" (
      "id", "tenant_id", "container_id", "node_code", "event_code", "time_kind",
      "occurred_at", "raw_value", "source_utc_offset", "ingestion_channel",
      "capture_source", "source_system", "authority_system", "verification_state",
      "confidence_state", "validity", "authority_policy_ref", "evidence_refs",
      "actor_id", "reason_code", "idempotency_key", "payload_hash", "is_current",
      "application_state", "projection_version", "trace_id", "received_at", "updated_at"
    ) VALUES (
      '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001', 'customs_clearance', 'inspection', 'actual',
      '2026-09-20T01:00:00Z', '2026-09-20T01:00:00Z', '+00:00', 'manual_ui',
      'manual_backfill', 'logix', 'customs', 'verified', 'confirmed', 'effective',
      'customs-inspection-v1', '["10000000-0000-4000-8000-000000000006"]'::jsonb,
      '10000000-0000-4000-8000-000000000007', 'inspection_notice', 'verify-fact-1',
      repeat('a', 64), true, 'pending_application', 1, 'verify-trace-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    INSERT INTO "node_block" (
      "id", "tenant_id", "flow_instance_id", "node_instance_id", "block_type",
      "source_fact_id", "occurred_at", "actor_id", "idempotency_key", "trace_id",
      "projection_version"
    ) VALUES (
      '10000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
      'inspection', '10000000-0000-4000-8000-000000000005',
      '2026-09-20T01:00:00Z', '10000000-0000-4000-8000-000000000007',
      'verify-block-1', 'verify-trace-2', 2
    );

    INSERT INTO "node_block_resolution" (
      "id", "tenant_id", "block_id", "resolved_at", "reason_code", "actor_id",
      "idempotency_key", "trace_id", "projection_version"
    ) VALUES (
      '10000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000008', '2026-09-20T02:00:00Z',
      'customs_released', '10000000-0000-4000-8000-000000000007',
      'verify-resolution-1', 'verify-trace-3', 3
    );
  `);
  const rows = await prisma.$queryRaw<Array<{ unresolvedCount: bigint }>>`
    SELECT COUNT(*) AS "unresolvedCount"
    FROM "node_block" b
    LEFT JOIN "node_block_resolution" r ON r."block_id" = b."id"
    WHERE b."node_instance_id" = '10000000-0000-4000-8000-000000000004'
      AND r."id" IS NULL
  `;
  if (Number(rows[0]?.unresolvedCount ?? -1) !== 0) {
    throw new Error("Lifecycle node block persistence verification failed");
  }
}
