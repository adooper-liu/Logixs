// NPI 待办队列与领取在**真实 PostgreSQL** 上的验证。
//
// 重点不在"能查到"，而在三件只有在真库上才立得住的事：并发领取只能成一个人、
// 幂等键重复提交不写第二条、跨租户一条都看不到。这些都靠唯一索引与事务，
// 单元测试里的替身替不掉。
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProductInitiativeDecisionCommandV1 } from "@logix/contracts";
import { PrismaClient } from "../../../../../generated/prisma";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import {
  completeUnitEconomicsDraft,
  PRODUCT_INITIATIVE_TEST_COMMITMENT,
  PRODUCT_INITIATIVE_TEST_CONTEXT,
} from "./product-initiative-test-fixtures";
import { prepareProductInitiativeDecision } from "../../modules/product-selection/domain/product-initiative";
import { prepareProductInitiativeClaim } from "../../modules/product-selection/domain/product-initiative-claim";
import { prepareOpportunityIntake } from "../../modules/product-selection/domain/product-opportunity";
import { PrismaProductInitiativeRepository } from "../../modules/product-selection/infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_npi_intake_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");

let prisma: PrismaClient;
let repository: PrismaProductInitiativeRepository;
let productOpportunities: PrismaProductOpportunityRepository;
let marketSignals: PrismaMarketSignalRepository;
const tenantId = randomUUID();

beforeAll(async () => {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  try {
    execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
      cwd: repositoryRoot,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "pipe",
    });
  } catch (error) {
    // execFileSync 的默认报错只有命令，不带迁移器说了什么；这里补上。
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `MIGRATION_DEPLOY_FAILED
${output.stdout?.toString() ?? ""}
${output.stderr?.toString() ?? ""}`,
      { cause: error },
    );
  }
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();
  repository = new PrismaProductInitiativeRepository(prisma as never);
  productOpportunities = new PrismaProductOpportunityRepository(
    prisma as never,
  );
  marketSignals = new PrismaMarketSignalRepository(prisma as never);
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

describe("NPI 待办队列", () => {
  it("交到产品侧的立项出现在待办里，还没人接时 claim 为空", async () => {
    const seeded = await seedHandoff({ objective: "验证宠物出行品类" });

    const rows = await repository.listNpiQueue({ tenantId, take: 50 });

    const row = rows.find(
      (entry) => entry.handoff.handoffId === seeded.handoffId,
    );
    expect(row?.handoff.objective).toBe("验证宠物出行品类");
    expect(row?.claim).toBeNull();
  });

  it("别人的租户一条都看不到", async () => {
    const theirs = await seedHandoff({ tenantId: randomUUID() });

    const rows = await repository.listNpiQueue({ tenantId, take: 200 });

    expect(rows.map((entry) => entry.handoff.handoffId)).not.toContain(
      theirs.handoffId,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("按交接时间倒序翻页，不重不漏", async () => {
    // 造够几条，否则每页两条的翻页根本走不到第二页，"不重不漏"就无从谈起。
    for (let index = 0; index < 5; index += 1) {
      await seedHandoff({ objective: `分页用立项 ${index}` });
    }
    const whole = await repository.listNpiQueue({ tenantId, take: 200 });
    expect(whole.length).toBeGreaterThan(2);

    const seen: string[] = [];
    let after: { createdAt: Date; id: string } | undefined;
    for (let guard = 0; guard < 50; guard += 1) {
      const page = await repository.listNpiQueue({ tenantId, after, take: 2 });
      seen.push(...page.map((entry) => entry.handoff.handoffId));
      if (page.length < 2) break;
      const last = page.at(-1)!;
      after = { createdAt: last.handoff.createdAt, id: last.handoff.handoffId };
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(whole.map((entry) => entry.handoff.handoffId));
  });
});

describe("NPI 领取", () => {
  it("领取后该票有明确的产品负责人，队列里能看到", async () => {
    const seeded = await seedHandoff({});

    const { record, duplicate } = await claim(
      seeded.handoffId,
      "product-owner",
    );

    expect(duplicate).toBe(false);
    expect(record).toMatchObject({
      productOwnerActorId: "product-owner",
      claimVersion: 1,
    });
    const entry = await repository.findNpiEntry(tenantId, seeded.handoffId);
    expect(entry?.claim?.productOwnerActorId).toBe("product-owner");
  });

  it("同一幂等键重复提交不写第二条，返回原回执", async () => {
    const seeded = await seedHandoff({});

    const first = await claim(seeded.handoffId, "product-owner", "same-key");
    const second = await claim(seeded.handoffId, "product-owner", "same-key");

    expect(second.duplicate).toBe(true);
    expect(second.record.claimId).toBe(first.record.claimId);
    expect(
      await prisma.productInitiativeClaim.count({
        where: { handoffId: seeded.handoffId },
      }),
    ).toBe(1);
  });

  it("幂等键被复用但载荷不同时明确失败，不悄悄当成重放", async () => {
    const seeded = await seedHandoff({});
    await claim(seeded.handoffId, "product-owner", "reused-key");

    await expect(
      claim(seeded.handoffId, "another-owner", "reused-key"),
    ).rejects.toThrow("PRODUCT_INITIATIVE_IDEMPOTENCY_CONFLICT");
  });

  it("已有人接之后再领必须失败，且库里仍只有一条回执", async () => {
    const seeded = await seedHandoff({});
    await claim(seeded.handoffId, "first-owner");

    await expect(claim(seeded.handoffId, "second-owner")).rejects.toThrow(
      "PRODUCT_INITIATIVE_CLAIM_VERSION_CONFLICT",
    );
    expect(
      await prisma.productInitiativeClaim.count({
        where: { handoffId: seeded.handoffId },
      }),
    ).toBe(1);
  });

  it("两个人同时领取，只能成一个人", async () => {
    const seeded = await seedHandoff({});

    const results = await Promise.allSettled([
      claim(seeded.handoffId, "owner-a"),
      claim(seeded.handoffId, "owner-b"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.productInitiativeClaim.count({
        where: { handoffId: seeded.handoffId },
      }),
    ).toBe(1);
  });

  it("别的租户领不走，也查不到", async () => {
    const seeded = await seedHandoff({});
    const stranger = randomUUID();

    await expect(
      claim(seeded.handoffId, "stranger", "k", stranger),
    ).rejects.toThrow("PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND");
    await expect(
      repository.findNpiEntry(stranger, seeded.handoffId),
    ).resolves.toBeNull();
  });
});

function claim(
  handoffId: string,
  actorId: string,
  idempotencyKey = `claim-${randomUUID()}`,
  owner = tenantId,
) {
  return repository.appendClaim({
    tenantId: owner,
    handoffId,
    command: prepareProductInitiativeClaim(
      { claimVersion: 0, productOwnerActorId: null },
      actorId,
      {
        contractVersion: "product-initiative-claim.v1",
        expectedClaimVersion: 0,
        idempotencyKey,
      },
    ),
  });
}

/**
 * 造一票已交到产品侧的立项。**走真实链路**（信号登记 → 交给选品 → 立项成立），
 * 而不是手工插行：交接快照的字段与约束由既有实现决定，手工插会随它们漂移。
 */
async function seedHandoff(
  options: { tenantId?: string; objective?: string } = {},
): Promise<{ handoffId: string }> {
  const owner = options.tenantId ?? tenantId;
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId: owner,
    actorId: "market-owner",
    command: normalizeMarketSignalCreate({
      contractVersion: "market-signal-create.v1",
      requestId: signalId,
      title: "加拿大站宠物出行需求上升",
      marketCode: "CA",
      channelCode: "amazon",
      idempotencyKey: `create:${signalId}`,
    }),
  });
  const decided = await marketSignals.decide({
    tenantId: owner,
    actorId: "market-owner",
    signalId,
    evidenceRefs: [],
    prepared: prepareMarketSignalDecision(
      { ...created.record, evidenceRefs: [] },
      {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: 1,
        decisionType: "handoff",
        opportunityStatement: "验证宠物出行机会是否值得立项。",
        idempotencyKey: `handoff:${signalId}`,
      },
    ),
  });
  await acceptOpportunity(
    productOpportunities,
    owner,
    decided.handoff!.handoffId,
  );

  const objective = options.objective ?? "验证宠物出行品类是否值得立项";
  const approved = await repository.persistDecision({
    tenantId: owner,
    handoffId: decided.handoff!.handoffId,
    actorId: "selector-1",
    command: prepareProductInitiativeDecision(
      { version: 0 },
      "selector-1",
      {
        contractVersion: "product-initiative-decision.v1",
        requestId: randomUUID(),
        outcome: "approve",
        expectedInitiativeVersion: 0,
        objective,
        ...PRODUCT_INITIATIVE_TEST_COMMITMENT,
        unitEconomicsDraft: completeUnitEconomicsDraft(),
        reviewPoints: REVIEW_POINT_CODES.map((code) => ({
          code,
          evidenceRefs: [randomUUID()],
          conclusion: "已核实",
        })),
        idempotencyKey: `decision:${randomUUID()}`,
      } as ProductInitiativeDecisionCommandV1,
      undefined,
      undefined,
      PRODUCT_INITIATIVE_TEST_CONTEXT,
    ),
  });

  const handoff = await prisma.productInitiativeHandoff.findFirstOrThrow({
    where: { initiativeId: approved.record.initiativeId, tenantId: owner },
    orderBy: { version: "desc" },
  });
  return { handoffId: handoff.id };
}

async function acceptOpportunity(
  opportunities: PrismaProductOpportunityRepository,
  owner: string,
  handoffId: string,
): Promise<void> {
  const actorId = "selector-1";
  await opportunities.appendIntake({
    tenantId: owner,
    handoffId,
    actorId,
    command: prepareOpportunityIntake(
      { version: 0, state: "queued", assignedActorId: null },
      actorId,
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "claim",
        expectedIntakeVersion: 0,
        idempotencyKey: `claim:${handoffId}`,
      },
    ),
  });
  await opportunities.appendIntake({
    tenantId: owner,
    handoffId,
    actorId,
    command: prepareOpportunityIntake(
      { version: 1, state: "claimed", assignedActorId: actorId },
      actorId,
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "accept",
        expectedIntakeVersion: 1,
        idempotencyKey: `accept:${handoffId}`,
      },
    ),
  });
}

const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
] as const;

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
