import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const firstTargetMigration = "20260921210000_add_work_order_fact_application";
const targetMigrationPaths = [
  `database/migrations/${firstTargetMigration}/migration.sql`,
  "database/migrations/20260921211000_drop_work_order_applicability_default/migration.sql",
  "database/migrations/20260921212000_align_work_execution_time_and_scope/migration.sql",
];
const targetMigrationSql = targetMigrationPaths.map((path) =>
  readFileSync(path, "utf8"),
);
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

class VerificationRollback extends Error {}

try {
  await assertSchema();
  await assertHistoricalBackfill();
  try {
    await prisma.$transaction(
      async (tx) => {
        await assertWritableCausationAndConstraints(tx);
        throw new VerificationRollback();
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (!(error instanceof VerificationRollback)) throw error;
  }
  console.log(
    "Work-order fact application verified: tenant backfill, immutable ledger, versions, causation, constraints and reconciliation Outbox passed.",
  );
} finally {
  await prisma.$disconnect();
}

await verifyLegacyUpgrade(connectionString);
await verifyEmptyDatabase(connectionString);

async function assertSchema(
  client: Pick<PrismaClient, "$queryRaw"> = prisma,
): Promise<void> {
  const rows = await client.$queryRaw<
    Array<{
      factApplicationTable: string | null;
      constraintCount: bigint;
      indexCount: bigint;
      immutableTriggerCount: bigint;
      timestamptzOutcomeColumnCount: bigint;
      workOrderApplicabilityDefault: string | null;
      missingTenantCount: bigint;
      tenantMismatchCount: bigint;
    }>
  >`
    SELECT
      to_regclass('public.work_order_fact_application')::text
        AS "factApplicationTable",
      COUNT(*) FILTER (
        WHERE constraint_name IN (
          'node_task_tenant_check',
          'node_task_version_check',
          'node_task_state_check',
          'work_order_version_check',
          'work_order_applicability_check',
          'work_order_state_check',
          'work_order_assignment_state_check',
          'work_order_fact_application_type_check',
          'work_order_fact_application_key_check',
          'work_order_fact_application_domain_fact_check',
          'work_order_fact_application_capture_source_check',
          'work_order_fact_application_evidence_refs_array_check',
          'work_order_fact_application_request_hash_check',
          'work_order_fact_application_decision_check',
          'work_order_fact_application_decision_reason_check',
          'work_order_fact_application_previous_state_check',
          'work_order_fact_application_resulting_state_check',
          'work_order_fact_application_decision_state_check',
          'work_order_fact_application_time_order_check',
          'work_order_fact_application_actor_check',
          'work_order_fact_application_trace_check',
          'node_task_outcome_required_ids_array_check',
          'node_task_outcome_completed_ids_array_check',
          'node_task_outcome_evaluated_fact_refs_array_check',
          'node_task_outcome_fact_causation_check'
        )
      ) AS "constraintCount",
      (
        SELECT COUNT(*)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'node_task_tenant_container_flow_node_idx',
            'work_order_node_task_idx',
            'work_order_fact_application_business_key',
            'work_order_fact_application_tenant_event_idx',
            'work_order_fact_application_event_idx',
            'work_order_fact_application_node_idx',
            'work_order_fact_application_domain_fact_idx'
          )
      ) AS "indexCount",
      (
        SELECT COUNT(*)
        FROM pg_trigger
        WHERE tgname = 'work_order_fact_application_immutable'
          AND NOT tgisinternal
      ) AS "immutableTriggerCount",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'node_task_outcome'
          AND column_name IN ('evaluated_at', 'created_at')
          AND data_type = 'timestamp with time zone'
      ) AS "timestamptzOutcomeColumnCount",
      (
        SELECT column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_order'
          AND column_name = 'applicability'
      ) AS "workOrderApplicabilityDefault",
      (SELECT COUNT(*) FROM node_task WHERE tenant_id IS NULL)
        AS "missingTenantCount",
      (
        SELECT COUNT(*)
        FROM node_task AS task
        JOIN flow_instance AS flow ON flow.id = task.flow_instance_id
        JOIN container_record AS container ON container.id = flow.container_id
        WHERE task.tenant_id IS DISTINCT FROM container.tenant_id
      ) AS "tenantMismatchCount"
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
  `;
  const row = rows[0];
  assert(
    row?.factApplicationTable === "work_order_fact_application",
    "fact application table is missing",
  );
  assert(
    Number(row?.constraintCount ?? 0) === 25,
    "fact application constraints are incomplete",
  );
  assert(
    Number(row?.indexCount ?? 0) === 7,
    "fact application indexes are incomplete",
  );
  assert(
    Number(row?.immutableTriggerCount ?? 0) === 1,
    "fact application immutability trigger is missing",
  );
  assert(
    Number(row?.timestamptzOutcomeColumnCount ?? 0) === 2,
    "node task outcome timestamps are not timezone-aware",
  );
  assert(
    row?.workOrderApplicabilityDefault === null,
    "work-order applicability still has a silent database default",
  );
  assert(
    Number(row?.missingTenantCount ?? 0) === 0,
    "node tasks contain a null tenant",
  );
  assert(
    Number(row?.tenantMismatchCount ?? 0) === 0,
    "node task tenant does not match its container",
  );
}

async function assertHistoricalBackfill(
  client: Pick<PrismaClient, "$queryRaw"> = prisma,
): Promise<void> {
  const [duplicates, missingMessages, duplicateMessages] = await Promise.all([
    client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM (
        SELECT work_order_id, business_fact_key
        FROM work_order_fact_application
        GROUP BY work_order_id, business_fact_key
        HAVING COUNT(*) > 1
      ) AS duplicate
    `,
    client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM node_event_application AS application
      LEFT JOIN outbox_message AS message
        ON message.event_type = 'work_execution.reconcile_applied_lifecycle_fact.requested'
       AND message.payload_ref = 'node-event-application/' || application.id
      WHERE application.state = 'applied'
      GROUP BY application.id
      HAVING COUNT(message.id) = 0
    `,
    client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM (
        SELECT application.id
        FROM node_event_application AS application
        JOIN outbox_message AS message
          ON message.event_type = 'work_execution.reconcile_applied_lifecycle_fact.requested'
         AND message.payload_ref = 'node-event-application/' || application.id
        WHERE application.state = 'applied'
        GROUP BY application.id
        HAVING COUNT(message.id) > 1
      ) AS duplicate
    `,
  ]);
  assert(
    Number(duplicates[0]?.count ?? 0) === 0,
    "duplicate work-order business fact keys exist",
  );
  assert(
    missingMessages.length === 0,
    "an applied node event has no reconciliation Outbox",
  );
  assert(
    Number(duplicateMessages[0]?.count ?? 0) === 0,
    "an applied node event has duplicate reconciliation Outbox messages",
  );
}

async function assertWritableCausationAndConstraints(
  tx: Pick<PrismaClient, "$executeRawUnsafe" | "$queryRaw">,
): Promise<void> {
  const suffix = randomUUID();
  const ids = {
    tenant: `tenant-${suffix}`,
    container: randomUUID(),
    flow: randomUUID(),
    node: randomUUID(),
    task: randomUUID(),
    workOrder: randomUUID(),
    event: randomUUID(),
    application: randomUUID(),
    outcome: randomUUID(),
  };
  await tx.$executeRawUnsafe(`
    INSERT INTO container_record
      (id, tenant_id, order_number, current_status, created_at, updated_at)
    VALUES
      ('${ids.container}', '${ids.tenant}', 'VERIFY-FACT-APPLICATION', 'unloaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO flow_instance
      (id, container_id, state, current_node_code, version, created_at, updated_at)
    VALUES
      ('${ids.flow}', '${ids.container}', 'active', 'container_unloading', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO node_instance
      (id, flow_instance_id, node_code, state, applicability)
    VALUES
      ('${ids.node}', '${ids.flow}', 'container_unloading', 'completed', 'required');

    INSERT INTO node_task (
      id, tenant_id, flow_instance_id, node_instance_id, node_code, container_id,
      task_definition_key, state, applicability, readiness_state,
      completion_eligibility, version, condition_fact_refs,
      conditions_evaluated_at, created_at, updated_at
    ) VALUES (
      '${ids.task}', '${ids.tenant}', '${ids.flow}', '${ids.node}',
      'container_unloading', '${ids.container}', 'node-container_unloading',
      'completed', 'required', 'ready', 'eligible', 1, '[]'::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    INSERT INTO work_order (
      id, node_task_id, work_order_definition_key, state, applicability,
      assignment_state, completed_at, version, created_at, updated_at
    ) VALUES (
      '${ids.workOrder}', '${ids.task}', 'wo-container_unloading', 'completed',
      'required', 'automatic', CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    INSERT INTO canonical_event (
      id, container_id, event_code, occurred_at, evidence_refs,
      idempotency_key, applied_at
    ) VALUES (
      '${ids.event}', '${ids.container}', 'unloaded', '2026-09-21T08:00:00Z', '[]'::jsonb,
      'verify-fact-application-${suffix}', CURRENT_TIMESTAMP
    );

    INSERT INTO work_order_fact_application (
      id, tenant_id, work_order_id, canonical_event_id, node_instance_id,
      business_fact_type, business_fact_key, domain_fact_id, capture_source,
      evidence_refs, occurred_at, received_at, recorded_at, request_hash,
      decision, decision_reason, previous_state, resulting_state, applied_at,
      actor_or_service_id, trace_id
    ) VALUES (
      '${ids.application}', '${ids.tenant}', '${ids.workOrder}', '${ids.event}',
      '${ids.node}', 'canonical_lifecycle_event',
      'lifecycle-node-application/${ids.event}/${ids.node}', '${ids.event}',
      'internal_operation', '[]'::jsonb, '2026-09-21T08:00:00Z',
      '2026-09-21T08:01:00Z', '2026-09-21T08:02:00Z', repeat('a', 64),
      'applied', NULL, 'ready', 'completed', '2026-09-21T08:03:00Z',
      'verification-service', 'verify-${suffix}'
    );

    INSERT INTO node_task_outcome (
      id, node_task_id, previous_state, next_state, result_policy_mode,
      event_code, policy_snapshot_hash, required_work_order_ids,
      completed_work_order_ids, evaluated_fact_refs, canonical_event_id,
      domain_fact_id, actor_or_service_id, trace_id, evaluated_at, created_at
    ) VALUES (
      '${ids.outcome}', '${ids.task}', 'in_progress', 'completed',
      'reference_existing_event', 'unloaded', repeat('b', 64),
      '["${ids.workOrder}"]'::jsonb, '["${ids.workOrder}"]'::jsonb,
      '["${ids.application}"]'::jsonb, '${ids.event}', '${ids.event}',
      'verification-service', 'verify-${suffix}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    DO $verify_constraints$
    BEGIN
      BEGIN
        INSERT INTO work_order_fact_application (
          id, tenant_id, work_order_id, canonical_event_id, node_instance_id,
          business_fact_type, business_fact_key, domain_fact_id, capture_source,
          evidence_refs, occurred_at, received_at, recorded_at, request_hash,
          decision, decision_reason, previous_state, resulting_state, applied_at,
          actor_or_service_id, trace_id
        ) SELECT
          gen_random_uuid()::text, tenant_id, work_order_id, canonical_event_id,
          node_instance_id, business_fact_type, business_fact_key, domain_fact_id,
          capture_source, evidence_refs, occurred_at, received_at, recorded_at,
          request_hash, decision, decision_reason, previous_state, resulting_state,
          applied_at, actor_or_service_id, trace_id
        FROM work_order_fact_application WHERE id = '${ids.application}';
        RAISE EXCEPTION 'duplicate business fact key was accepted';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;

      BEGIN
        INSERT INTO work_order_fact_application (
          id, tenant_id, work_order_id, canonical_event_id, node_instance_id,
          business_fact_type, business_fact_key, domain_fact_id, capture_source,
          evidence_refs, occurred_at, received_at, recorded_at, request_hash,
          decision, decision_reason, previous_state, resulting_state, applied_at,
          actor_or_service_id, trace_id
        ) SELECT
          gen_random_uuid()::text, tenant_id, work_order_id, canonical_event_id,
          node_instance_id, business_fact_type, business_fact_key || '/invalid',
          domain_fact_id, capture_source, '{}'::jsonb, occurred_at, received_at,
          recorded_at, 'NOT-SHA256', decision, decision_reason, previous_state,
          resulting_state, applied_at, actor_or_service_id, trace_id
        FROM work_order_fact_application WHERE id = '${ids.application}';
        RAISE EXCEPTION 'invalid fact application was accepted';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      BEGIN
        UPDATE work_order_fact_application
        SET trace_id = 'changed'
        WHERE id = '${ids.application}';
        RAISE EXCEPTION 'immutable fact application was updated';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'work_order_fact_application is immutable' THEN RAISE; END IF;
      END;
    END
    $verify_constraints$;
  `);

  const rows = await tx.$queryRaw<
    Array<{ factCount: bigint; causalOutcomeCount: bigint }>
  >`
    SELECT
      (SELECT COUNT(*) FROM work_order_fact_application
       WHERE id = ${ids.application}) AS "factCount",
      (SELECT COUNT(*) FROM node_task_outcome
       WHERE id = ${ids.outcome}
         AND canonical_event_id = ${ids.event}
         AND jsonb_array_length(evaluated_fact_refs) = 1) AS "causalOutcomeCount"
  `;
  assert(
    Number(rows[0]?.factCount ?? 0) === 1,
    "valid fact application was not stored",
  );
  assert(
    Number(rows[0]?.causalOutcomeCount ?? 0) === 1,
    "causal outcome was not stored",
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function verifyLegacyUpgrade(source: string): Promise<void> {
  await withTemporaryDatabase(source, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-work-fact-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      const target = createPrisma(targetUrl);
      const rollback = new VerificationRollback();
      try {
        try {
          await target.$transaction(
            async (tx) => {
              const fixture = await insertLegacyFixture(tx);
              for (const sql of targetMigrationSql) {
                await tx.$executeRawUnsafe(sql);
              }
              await assertSchema(tx as unknown as PrismaClient);
              await assertHistoricalBackfill(tx as unknown as PrismaClient);
              const rows = await tx.$queryRaw<
                Array<{
                  tenantId: string | null;
                  taskVersion: number;
                  applicability: string;
                  workOrderVersion: number;
                  evaluatedFactRefs: unknown;
                  messageCount: bigint;
                }>
              >`
                SELECT
                  task.tenant_id AS "tenantId",
                  task.version AS "taskVersion",
                  work_order.applicability,
                  work_order.version AS "workOrderVersion",
                  outcome.evaluated_fact_refs AS "evaluatedFactRefs",
                  (
                    SELECT COUNT(*)
                    FROM outbox_message AS message
                    WHERE message.event_type = 'work_execution.reconcile_applied_lifecycle_fact.requested'
                      AND message.payload_ref = 'node-event-application/' || ${fixture.nodeApplicationId}
                  ) AS "messageCount"
                FROM node_task AS task
                JOIN work_order ON work_order.node_task_id = task.id
                JOIN node_task_outcome AS outcome ON outcome.node_task_id = task.id
                WHERE task.id = ${fixture.taskId}
              `;
              const row = rows[0];
              assert(
                row?.tenantId === fixture.tenantId,
                "legacy task tenant was not backfilled",
              );
              assert(
                row?.taskVersion === 0,
                "legacy task version did not start at zero",
              );
              assert(
                row?.applicability === "required",
                "legacy work-order applicability was not restored",
              );
              assert(
                row?.workOrderVersion === 0,
                "legacy work-order version did not start at zero",
              );
              assert(
                Array.isArray(row?.evaluatedFactRefs) &&
                  row.evaluatedFactRefs.length === 0,
                "legacy outcome fact refs were not restored as an empty array",
              );
              assert(
                Number(row?.messageCount ?? 0) === 1,
                "legacy applied node fact did not receive exactly one Outbox message",
              );
              throw rollback;
            },
            { timeout: 30_000 },
          );
        } catch (error) {
          if (error !== rollback) throw error;
        }
      } finally {
        await target.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Work-order fact application verified: legacy database upgrade passed and was rolled back.",
  );
}

async function verifyEmptyDatabase(source: string): Promise<void> {
  await withTemporaryDatabase(source, "empty", async (targetUrl) => {
    const pnpmCli = process.env.npm_execpath;
    if (!pnpmCli) throw new Error("npm_execpath is required to run migrations");
    const migration = spawnSync(process.execPath, [pnpmCli, "db:migrate"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: targetUrl },
      encoding: "utf8",
      stdio: "pipe",
    });
    if (migration.status !== 0) {
      throw new Error(
        `Empty database migration failed:\n${migration.stdout ?? ""}\n${migration.stderr ?? ""}`,
      );
    }
    const target = createPrisma(targetUrl);
    try {
      await assertSchema(target);
      await assertHistoricalBackfill(target);
    } finally {
      await target.$disconnect();
    }
  });
  console.log(
    "Work-order fact application verified: empty database migration chain passed.",
  );
}

async function withTemporaryDatabase(
  source: string,
  suffix: "upgrade" | "empty",
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_work_fact_${suffix}_${process.pid}_${Date.now()}`;
  if (
    !/^logix_verify_work_fact_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)
  ) {
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

async function insertLegacyFixture(
  client: Pick<PrismaClient, "$executeRawUnsafe">,
): Promise<{ tenantId: string; taskId: string; nodeApplicationId: string }> {
  const suffix = randomUUID();
  const tenantId = `tenant-${suffix}`;
  const containerId = randomUUID();
  const flowId = randomUUID();
  const nodeId = randomUUID();
  const taskId = randomUUID();
  const workOrderId = randomUUID();
  const eventId = randomUUID();
  const nodeApplicationId = randomUUID();
  await client.$executeRawUnsafe(`
    INSERT INTO container_record
      (id, tenant_id, order_number, current_status, created_at, updated_at)
    VALUES
      ('${containerId}', '${tenantId}', 'VERIFY-LEGACY-WORK-FACT', 'unloaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO flow_instance
      (id, container_id, state, current_node_code, version, created_at, updated_at)
    VALUES
      ('${flowId}', '${containerId}', 'active', 'container_unloading', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO node_instance
      (id, flow_instance_id, node_code, state, applicability)
    VALUES
      ('${nodeId}', '${flowId}', 'container_unloading', 'completed', 'required');
    INSERT INTO node_task (
      id, flow_instance_id, node_instance_id, node_code, container_id,
      task_definition_key, state, applicability, readiness_state,
      completion_eligibility, condition_fact_refs, conditions_evaluated_at,
      created_at, updated_at
    ) VALUES (
      '${taskId}', '${flowId}', '${nodeId}', 'container_unloading', '${containerId}',
      'node-container_unloading', 'completed', 'required', 'ready', 'eligible',
      '[]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO work_order (
      id, node_task_id, work_order_definition_key, state, assignment_state,
      completed_at, created_at, updated_at
    ) VALUES (
      '${workOrderId}', '${taskId}', 'wo-container_unloading', 'completed',
      'automatic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO node_task_outcome (
      id, node_task_id, previous_state, next_state, result_policy_mode,
      event_code, policy_snapshot_hash, required_work_order_ids,
      completed_work_order_ids, evaluated_at, created_at
    ) VALUES (
      '${randomUUID()}', '${taskId}', 'in_progress', 'completed', 'none', NULL,
      repeat('a', 64), '["${workOrderId}"]'::jsonb,
      '["${workOrderId}"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO canonical_event (
      id, container_id, event_code, occurred_at, evidence_refs,
      idempotency_key, applied_at
    ) VALUES (
      '${eventId}', '${containerId}', 'unloaded', '2026-09-21T08:00:00Z',
      '[]'::jsonb, 'verify-legacy-work-fact-${suffix}', CURRENT_TIMESTAMP
    );
    INSERT INTO node_event_application (
      id, event_id, target_node_instance_id, state, evaluated_at,
      guard_results, applied_at, created_at, updated_at
    ) VALUES (
      '${nodeApplicationId}', '${eventId}', '${nodeId}', 'applied',
      CURRENT_TIMESTAMP, '[]'::jsonb, CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  `);
  return { tenantId, taskId, nodeApplicationId };
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
