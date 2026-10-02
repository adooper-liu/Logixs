import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const ACTIVE_VALIDATION_MIGRATION =
  "20261002120000_add_market_signal_active_validation";
const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_ms_val_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
const tenantId = randomUUID();
const focusedSignalId = randomUUID();
const legacySignalId = randomUUID();
let prisma: PrismaClient;

beforeAll(async () => {
  deploy();
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();

  if (await migrationWasApplied()) {
    await rollBackActiveValidationMigration();
  }
  await seedPreviousVersionWatchingSignal({
    signalId: focusedSignalId,
    actorId: "market-owner-focused",
    focus: "确认趋势是否持续两周",
    dueDate: "2026-02-12",
  });
  await seedPreviousVersionWatchingSignal({
    signalId: legacySignalId,
    actorId: "market-owner-legacy",
    focus: null,
    dueDate: "2026-02-19",
  });

  deploy();
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: createPostgresAdapter(
      withSchema(BASE_DATABASE_URL, "public"),
      "public",
    ),
  });
  try {
    await admin.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  } finally {
    await admin.$disconnect();
  }
});

describe("market signal active validation migration upgrade", () => {
  it("backfills owner and date from the latest completed watch without inventing legacy focus", async () => {
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        active_validation_owner_actor_id: string | null;
        active_validation_due_date: Date | null;
        active_validation_focus: string | null;
        active_validation_waiting_reason: string | null;
      }[]
    >(
      `SELECT "id", "active_validation_owner_actor_id", "active_validation_due_date",
              "active_validation_focus", "active_validation_waiting_reason"
       FROM "${schemaName}"."market_signal"
       WHERE "id" = ANY($1::uuid[])
       ORDER BY "id"`,
      [focusedSignalId, legacySignalId],
    );

    const focused = rows.find(({ id }) => id === focusedSignalId);
    const legacy = rows.find(({ id }) => id === legacySignalId);
    expect(focused).toMatchObject({
      active_validation_owner_actor_id: "market-owner-focused",
      active_validation_focus: "确认趋势是否持续两周",
      active_validation_waiting_reason: null,
    });
    expect(focused?.active_validation_due_date?.toISOString().slice(0, 10)).toBe(
      "2026-02-12",
    );
    expect(legacy).toMatchObject({
      active_validation_owner_actor_id: "market-owner-legacy",
      active_validation_focus: null,
      active_validation_waiting_reason: null,
    });
    expect(legacy?.active_validation_due_date?.toISOString().slice(0, 10)).toBe(
      "2026-02-19",
    );
  });

  it("records the migration exactly once", async () => {
    const rows = await prisma.$queryRawUnsafe<
      { migration_name: string; finished_at: Date | null }[]
    >(
      `SELECT "migration_name", "finished_at"
       FROM "${schemaName}"."_prisma_migrations"
       WHERE "migration_name" = $1`,
      ACTIVE_VALIDATION_MIGRATION,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.finished_at).toBeInstanceOf(Date);
  });

  it("rejects blank and oversized waiting reasons at the database boundary", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}"."market_signal_decision"
         SET "waiting_reason" = '   '
         WHERE "signal_id" = $1`,
        focusedSignalId,
      ),
    ).rejects.toThrow(/market_signal_decision_waiting_reason_check/);

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}"."market_signal"
         SET "active_validation_waiting_reason" = $1
         WHERE "id" = $2`,
        "x".repeat(501),
        focusedSignalId,
      ),
    ).rejects.toThrow(/market_signal_active_validation_text_check/);
  });
});

async function migrationWasApplied(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) AS "count"
     FROM "${schemaName}"."_prisma_migrations"
     WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL`,
    ACTIVE_VALIDATION_MIGRATION,
  );
  return rows[0]?.count === 1n;
}

async function rollBackActiveValidationMigration(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS "${schemaName}"."market_signal_validation_queue_idx"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."market_signal_decision"
       DROP CONSTRAINT IF EXISTS "market_signal_decision_shape_check",
       DROP CONSTRAINT IF EXISTS "market_signal_decision_text_check",
       DROP CONSTRAINT IF EXISTS "market_signal_decision_pending_codes_check",
       DROP CONSTRAINT IF EXISTS "market_signal_decision_waiting_reason_check",
       DROP COLUMN IF EXISTS "waiting_reason"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."market_signal_decision"
       ADD CONSTRAINT "market_signal_decision_shape_check" CHECK (
         ("decision_type" = 'watch' AND "opportunity_statement" IS NULL AND "dismiss_reason" IS NULL AND
           (("completion_state" = 'completed' AND "next_review_date" IS NOT NULL) OR
            ("completion_state" = 'pending_completion' AND "next_review_date" IS NULL))) OR
         ("decision_type" = 'handoff' AND "completion_state" = 'completed' AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "dismiss_reason" IS NULL) OR
         ("decision_type" = 'dismiss' AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND
           (("completion_state" = 'completed' AND "dismiss_reason" IS NOT NULL) OR
            ("completion_state" = 'pending_completion' AND "dismiss_reason" IS NULL))) OR
         ("decision_type" = 'selection_return' AND "completion_state" = 'completed' AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "dismiss_reason" IS NULL AND "judgment_note" IS NOT NULL) OR
         ("decision_type" IN ('void', 'archive') AND "opportunity_statement" IS NULL AND "next_review_date" IS NULL AND "watch_focus" IS NULL AND "dismiss_reason" IS NULL AND
           (("completion_state" = 'completed' AND "judgment_note" IS NOT NULL) OR
            ("completion_state" = 'pending_completion' AND "judgment_note" IS NULL)))
       ),
       ADD CONSTRAINT "market_signal_decision_text_check" CHECK (
         ("judgment_note" IS NULL OR length(btrim("judgment_note")) BETWEEN 1 AND 4000) AND
         ("opportunity_statement" IS NULL OR length(btrim("opportunity_statement")) BETWEEN 1 AND 4000) AND
         ("watch_focus" IS NULL OR length(btrim("watch_focus")) BETWEEN 1 AND 4000) AND
         ("dismiss_reason" IS NULL OR length(btrim("dismiss_reason")) BETWEEN 1 AND 500) AND
         length(btrim("created_by")) BETWEEN 1 AND 200 AND
         length(btrim("idempotency_key")) BETWEEN 1 AND 200
       ),
       ADD CONSTRAINT "market_signal_decision_pending_codes_check" CHECK (
         "pending_field_codes" <@ ARRAY[
           'market_code', 'channel_code', 'category_ref', 'observed_fact_summary',
           'hypothesis', 'evidence_refs', 'opportunity_statement',
           'next_review_date', 'dismiss_reason', 'close_reason'
         ]::TEXT[]
       )`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."market_signal"
       DROP CONSTRAINT IF EXISTS "market_signal_active_validation_shape_check",
       DROP CONSTRAINT IF EXISTS "market_signal_active_validation_text_check",
       DROP COLUMN IF EXISTS "active_validation_owner_actor_id",
       DROP COLUMN IF EXISTS "active_validation_due_date",
       DROP COLUMN IF EXISTS "active_validation_focus",
       DROP COLUMN IF EXISTS "active_validation_waiting_reason"`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "${schemaName}"."_prisma_migrations"
     WHERE "migration_name" = $1`,
    ACTIVE_VALIDATION_MIGRATION,
  );
}

async function seedPreviousVersionWatchingSignal(input: {
  signalId: string;
  actorId: string;
  focus: string | null;
  dueDate: string;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}"."market_signal" (
       "id", "tenant_id", "title", "current_destination", "owner_team_code",
       "version", "created_by", "updated_by", "create_idempotency_key", "create_payload_hash"
     ) VALUES ($1,$2,$3,'watching','market_intelligence',2,$4,$4,$5,repeat('a',64))`,
    input.signalId,
    tenantId,
    `[升级演练] ${input.signalId}`,
    input.actorId,
    `create:${input.signalId}`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}"."market_signal_decision" (
       "id", "tenant_id", "signal_id", "decision_version", "signal_version",
       "decision_type", "completion_state", "next_review_date", "watch_focus",
       "pending_field_codes", "created_by", "idempotency_key", "payload_hash"
     ) VALUES ($1,$2,$3,1,2,'watch','completed',$4,$5,'{}'::text[],$6,$7,repeat('b',64))`,
    randomUUID(),
    tenantId,
    input.signalId,
    input.dueDate,
    input.focus,
    input.actorId,
    `watch:${input.signalId}`,
  );
}

function deploy(): void {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  try {
    execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
      cwd: repositoryRoot,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "pipe",
    });
  } catch (error) {
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `MIGRATION_DEPLOY_FAILED\n${output.stdout?.toString() ?? ""}\n${output.stderr?.toString() ?? ""}`,
      { cause: error },
    );
  }
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
