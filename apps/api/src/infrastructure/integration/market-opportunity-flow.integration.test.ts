import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import { prepareOpportunityIntake } from "../../modules/product-selection/domain/product-opportunity";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_market_opportunity_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
let prisma: PrismaClient;
let marketSignals: PrismaMarketSignalRepository;
let productOpportunities: PrismaProductOpportunityRepository;

beforeAll(async () => {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl },
      { schema: schemaName },
    ),
  });
  await prisma.$connect();
  marketSignals = new PrismaMarketSignalRepository(prisma as never);
  productOpportunities = new PrismaProductOpportunityRepository(
    prisma as never,
  );
});

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: withSchema(BASE_DATABASE_URL, "public") },
      { schema: "public" },
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

describe("market opportunity persistence flow", () => {
  it("atomically hands ordinary gaps to product selection and replays idempotently", async () => {
    const tenantId = randomUUID();
    const actorId = "market-owner";
    const signalId = randomUUID();
    const created = await marketSignals.create({
      tenantId,
      actorId,
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: signalId,
        title: "加拿大站宠物出行需求上升",
        marketCode: "CA",
        idempotencyKey: `create:${signalId}`,
      }),
    });
    const prepared = prepareMarketSignalDecision(
      { ...created.record, evidenceRefs: [] },
      {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: 1,
        decisionType: "handoff",
        opportunityStatement: "验证宠物出行机会是否值得立项。",
        idempotencyKey: `handoff:${signalId}`,
      },
    );

    const first = await marketSignals.decide({
      tenantId,
      actorId,
      signalId,
      evidenceRefs: [],
      prepared,
    });
    const replay = await marketSignals.decide({
      tenantId,
      actorId,
      signalId,
      evidenceRefs: [],
      prepared,
    });

    expect(first).toMatchObject({
      duplicate: false,
      signal: { currentDestination: "handed_off", version: 2 },
      handoff: {
        recipientQueueCode: "product_selection",
        pendingFieldCodes: [
          "channel_code",
          "category_ref",
          "observed_fact_summary",
          "hypothesis",
          "evidence_refs",
        ],
      },
    });
    expect(replay).toMatchObject({
      duplicate: true,
      handoff: { handoffId: first.handoff!.handoffId },
    });
    await expect(
      prisma.marketSignalDecision.count({ where: { tenantId, signalId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.marketOpportunityHandoff.count({ where: { tenantId, signalId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxMessage.count({
        where: {
          tenantId,
          eventType: "market_opportunity_handoff.created",
          aggregateId: signalId,
        },
      }),
    ).resolves.toBe(1);

    const queue = await productOpportunities.list({ tenantId, take: 10 });
    expect(queue).toEqual([
      expect.objectContaining({
        intakeState: "queued",
        intakeVersion: 0,
        handoff: expect.objectContaining({
          handoffId: first.handoff!.handoffId,
        }),
      }),
    ]);
    await expect(
      productOpportunities.findByHandoffId(
        randomUUID(),
        first.handoff!.handoffId,
      ),
    ).resolves.toBeNull();

    const claim = prepareOpportunityIntake(
      { version: 0, state: "queued", assignedActorId: null },
      "selector-a",
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "claim",
        expectedIntakeVersion: 0,
        idempotencyKey: `claim:${first.handoff!.handoffId}`,
      },
    );
    const claimed = await productOpportunities.appendIntake({
      tenantId,
      handoffId: first.handoff!.handoffId,
      actorId: "selector-a",
      command: claim,
    });
    const claimReplay = await productOpportunities.appendIntake({
      tenantId,
      handoffId: first.handoff!.handoffId,
      actorId: "selector-a",
      command: claim,
    });
    expect(claimed).toMatchObject({
      duplicate: false,
      record: {
        intakeState: "claimed",
        intakeVersion: 1,
        assignedActorId: "selector-a",
      },
    });
    expect(claimReplay.duplicate).toBe(true);

    const accepted = await productOpportunities.appendIntake({
      tenantId,
      handoffId: first.handoff!.handoffId,
      actorId: "selector-a",
      command: prepareOpportunityIntake(
        {
          version: 1,
          state: "claimed",
          assignedActorId: "selector-a",
        },
        "selector-a",
        {
          contractVersion: "product-opportunity-intake.v1",
          action: "accept",
          expectedIntakeVersion: 1,
          idempotencyKey: `accept:${first.handoff!.handoffId}`,
        },
      ),
    });
    expect(accepted.record).toMatchObject({
      intakeState: "accepted",
      intakeVersion: 2,
      assignedActorId: "selector-a",
    });
  });

  it("allows only one concurrent claim for the same queued handoff", async () => {
    const tenantId = randomUUID();
    const handoffId = await createHandoff(tenantId, "并发领取验证信号");
    const claimA = prepareOpportunityIntake(
      { version: 0, state: "queued", assignedActorId: null },
      "selector-a",
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "claim",
        expectedIntakeVersion: 0,
        idempotencyKey: `claim-a:${handoffId}`,
      },
    );
    const claimB = prepareOpportunityIntake(
      { version: 0, state: "queued", assignedActorId: null },
      "selector-b",
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "claim",
        expectedIntakeVersion: 0,
        idempotencyKey: `claim-b:${handoffId}`,
      },
    );

    const results = await Promise.allSettled([
      productOpportunities.appendIntake({
        tenantId,
        handoffId,
        actorId: "selector-a",
        command: claimA,
      }),
      productOpportunities.appendIntake({
        tenantId,
        handoffId,
        actorId: "selector-b",
        command: claimB,
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    await expect(
      prisma.productOpportunityIntake.count({ where: { tenantId, handoffId } }),
    ).resolves.toBe(1);
  });
});

async function createHandoff(tenantId: string, title: string): Promise<string> {
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId,
    actorId: "market-owner",
    command: normalizeMarketSignalCreate({
      contractVersion: "market-signal-create.v1",
      requestId: signalId,
      title,
      idempotencyKey: `create:${signalId}`,
    }),
  });
  const result = await marketSignals.decide({
    tenantId,
    actorId: "market-owner",
    signalId,
    evidenceRefs: [],
    prepared: prepareMarketSignalDecision(
      { ...created.record, evidenceRefs: [] },
      {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: 1,
        decisionType: "handoff",
        idempotencyKey: `handoff:${signalId}`,
      },
    ),
  });
  return result.handoff!.handoffId;
}

function withSchema(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("schema", schema);
  return parsed.toString();
}
