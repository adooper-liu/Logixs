import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const MIGRATION = "20261004120000_add_market_selection_return_takeback";
const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_ms_takeback_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
let prisma: PrismaClient;
const tenantId = randomUUID();
const signalId = randomUUID();
const handoffId = randomUUID();
const initiativeId = randomUUID();

beforeAll(async () => {
  deploy();
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();
  await seedBase();
  await restorePreviousShape();
  await seedLegacyReturn();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "${schemaName}"."_prisma_migrations" WHERE "migration_name" = $1`,
    MIGRATION,
  );
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

describe("market selection return takeback migration upgrade", () => {
  it("preserves legacy returned rows and adds nullable structured basis", async () => {
    await expect(
      prisma.productInitiative.findUniqueOrThrow({
        where: { id: initiativeId },
      }),
    ).resolves.toMatchObject({
      currentDestination: "returned_to_market",
      returnBasis: null,
    });
    await expect(
      prisma.marketSignal.findUniqueOrThrow({ where: { id: signalId } }),
    ).resolves.toMatchObject({ currentDestination: "returned_from_selection" });
    const legacy = await prisma.marketSignalDecision.findFirstOrThrow({
      where: { signalId, decisionType: "selection_return" },
    });
    expect(legacy.returnBasis).toBeNull();
  });

  it("accepts the new request states and constrained basis", async () => {
    await prisma.marketSignal.update({
      where: { id: signalId },
      data: { currentDestination: "selection_return_requested" },
    });
    await prisma.productInitiative.update({
      where: { id: initiativeId },
      data: {
        currentDestination: "return_requested",
        returnBasis: "wrong_direction",
      },
    });
    await expect(
      prisma.productInitiative.update({
        where: { id: initiativeId },
        data: { returnBasis: "unknown" },
      }),
    ).rejects.toThrow(/product_initiative_return_basis_check/);
  });
});

async function seedBase(): Promise<void> {
  await prisma.marketSignal.create({
    data: {
      id: signalId,
      tenantId,
      title: "legacy signal",
      currentDestination: "handed_off",
      ownerTeamCode: "market_intelligence",
      version: 2,
      createdBy: "market-owner",
      updatedBy: "market-owner",
      createIdempotencyKey: `create:${signalId}`,
      createPayloadHash: "a".repeat(64),
    },
  });
  await prisma.marketOpportunityHandoff.create({
    data: {
      id: handoffId,
      tenantId,
      signalId,
      version: 1,
      signalVersion: 2,
      title: "legacy signal",
      recipientQueueCode: "product_selection",
      evidenceRefs: [],
      pendingFieldCodes: [],
      createdBy: "market-owner",
      idempotencyKey: `handoff:${signalId}`,
      payloadHash: "b".repeat(64),
    },
  });
}

async function restorePreviousShape(): Promise<void> {
  const sql = `
    ALTER TABLE "${schemaName}"."product_initiative" DROP CONSTRAINT "product_initiative_shape_check";
    ALTER TABLE "${schemaName}"."product_initiative" DROP CONSTRAINT "product_initiative_destination_check";
    ALTER TABLE "${schemaName}"."product_initiative" DROP CONSTRAINT "product_initiative_pending_codes_check";
    ALTER TABLE "${schemaName}"."product_initiative" DROP COLUMN "return_basis";
    ALTER TABLE "${schemaName}"."product_initiative" ADD CONSTRAINT "product_initiative_shape_check" CHECK (true);
    ALTER TABLE "${schemaName}"."product_initiative" ADD CONSTRAINT "product_initiative_destination_check" CHECK ("current_destination" IN ('needs_decision','deferred','rejected','returned_to_market','handed_off','returned_from_npi'));
    ALTER TABLE "${schemaName}"."product_initiative" ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (true);
    ALTER TABLE "${schemaName}"."market_signal" DROP CONSTRAINT "market_signal_destination_check";
    ALTER TABLE "${schemaName}"."market_signal" ADD CONSTRAINT "market_signal_destination_check" CHECK ("current_destination" IN ('needs_decision','watching','handed_off','dismissed','returned_from_selection','voided','archived'));
    ALTER TABLE "${schemaName}"."market_signal_decision" DROP CONSTRAINT "market_signal_decision_shape_check";
    ALTER TABLE "${schemaName}"."market_signal_decision" DROP CONSTRAINT "market_signal_decision_type_check";
    ALTER TABLE "${schemaName}"."market_signal_decision" DROP COLUMN "return_basis";
    ALTER TABLE "${schemaName}"."market_signal_decision" ADD CONSTRAINT "market_signal_decision_shape_check" CHECK (true);
    ALTER TABLE "${schemaName}"."market_signal_decision" ADD CONSTRAINT "market_signal_decision_type_check" CHECK ("decision_type" IN ('watch','handoff','dismiss','selection_return','void','archive'));
  `;
  await prisma.$executeRawUnsafe(sql);
}

async function seedLegacyReturn(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}"."product_initiative" ("id","tenant_id","handoff_id","version","outcome","completion_state","current_destination","responsible_actor_id","objective","review_points","reason","pending_field_codes","acted_by","idempotency_key","payload_hash") VALUES ($1,$2,$3,1,'return_to_market','completed','returned_to_market','selector-1',NULL,'[]'::jsonb,'补充市场事实','{}'::text[],'selector-1',$4,repeat('c',64))`,
    initiativeId,
    tenantId,
    handoffId,
    `initiative:${initiativeId}`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}"."market_signal_decision" ("id","tenant_id","signal_id","decision_version","signal_version","decision_type","completion_state","judgment_note","pending_field_codes","created_by","idempotency_key","payload_hash") VALUES ($1,$2,$3,1,3,'selection_return','completed','补充市场事实','{}'::text[],'selector-1',$4,repeat('d',64))`,
    randomUUID(),
    tenantId,
    signalId,
    `selection-return:${signalId}`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "${schemaName}"."market_signal" SET "current_destination"='returned_from_selection', "version"=3 WHERE "id"=$1`,
    signalId,
  );
}

function deploy(): void {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
