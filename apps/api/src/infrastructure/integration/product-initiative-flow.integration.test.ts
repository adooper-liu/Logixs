import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { ApplySelectionReturnService } from "../../modules/market-intelligence/application/apply-selection-return.service";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import type { ProductInitiativeDecisionCommandV1 } from "@logix/contracts";
import {
  ProductInitiativeConflictError,
  prepareProductInitiativeDecision,
  prepareSelectionReturnTakeback,
} from "../../modules/product-selection/domain/product-initiative";
import { PrismaProductInitiativeRepository } from "../../modules/product-selection/infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";
import { toOpportunityV1 } from "../../modules/product-selection/application/list-product-opportunities.service";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_product_initiative_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
let prisma: PrismaClient;
let marketSignals: PrismaMarketSignalRepository;
let initiatives: PrismaProductInitiativeRepository;
let productOpportunities: PrismaProductOpportunityRepository;

const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
] as const;

beforeAll(async () => {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();
  marketSignals = new PrismaMarketSignalRepository(prisma as never);
  const applySelectionReturn = new ApplySelectionReturnService(marketSignals);
  initiatives = new PrismaProductInitiativeRepository(
    prisma as never,
    applySelectionReturn,
  );
  productOpportunities = new PrismaProductOpportunityRepository(
    prisma as never,
  );
});

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

describe("product initiative persistence flow", () => {
  it("暂缓缺原因时保存但不关闭，且不改写缺口之外的任何东西", async () => {
    const { tenantId, handoffId } = await seedOpportunity();

    const { record, duplicate } = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide({ handoffId }, { outcome: "defer" }),
    });

    expect(duplicate).toBe(false);
    expect(record).toMatchObject({
      handoffId,
      version: 1,
      outcome: "defer",
      completion: "pending_completion",
      currentDestination: "needs_decision",
      responsibleActorId: "selector-1",
      reason: null,
    });
    expect(record.pendingFieldCodes).toContain("defer_reason");
    // 没有立项就不该有交接快照，也不该有对外事件。
    // 注意按事件类型收窄：建场时经营交接本身已写过一条 Outbox，属正常。
    await expect(
      prisma.productInitiativeHandoff.count({ where: { tenantId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.outboxMessage.count({
        where: { tenantId, eventType: "product_initiative.handed_off" },
      }),
    ).resolves.toBe(0);
  });

  it("同一幂等键重放返回同一结果且不新增行", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    const command = decide(
      { handoffId },
      { outcome: "defer", deferReason: "等大促后重看竞争供给" },
    );

    const first = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command,
    });
    const replay = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command,
    });

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(replay.record.initiativeId).toBe(first.record.initiativeId);
    await expect(
      prisma.productInitiative.count({ where: { tenantId } }),
    ).resolves.toBe(1);
  });

  it("同一幂等键换内容明确冲突", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    const command = decide({ handoffId }, { outcome: "defer" });
    await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command,
    });

    await expect(
      initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: { ...command, payloadHash: "f".repeat(64) },
      }),
    ).rejects.toThrowError(ProductInitiativeConflictError);
  });

  it("暂缓后补齐要点再立项：版本递增并原子写快照与 Outbox", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    const deferred = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide({ handoffId }, { outcome: "defer" }),
    });
    expect(deferred.record.version).toBe(1);

    const approved = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId, expectedInitiativeVersion: 1 },
        {
          outcome: "approve",
          objective: "把折叠宠物出行包做成可发布版本",
          reviewPoints: REVIEW_POINT_CODES.map((code, index) => ({
            code,
            evidenceRefs: [evidenceId(index)],
            conclusion: `${code} 的结论`,
          })),
        },
      ),
    });

    expect(approved.record).toMatchObject({
      version: 2,
      outcome: "approve",
      completion: "completed",
      currentDestination: "handed_off",
      // customer_feedback 是非门槛缺口：立项可完成但仍会报告待补。
      pendingFieldCodes: ["customer_feedback"],
    });
    const snapshot = await prisma.productInitiativeHandoff.findFirst({
      where: { tenantId, initiativeId: approved.record.initiativeId },
    });
    expect(snapshot).toMatchObject({
      version: 2,
      objective: "把折叠宠物出行包做成可发布版本",
      responsibleActorId: "selector-1",
      marketCode: "CA",
      userProblem: "验证宠物出行机会是否值得立项。",
    });
    // 快照汇总要点引用到的证据，产品侧一次取全依据。
    expect(snapshot!.evidenceRefs).toEqual([
      evidenceId(0),
      evidenceId(1),
      evidenceId(2),
      evidenceId(3),
    ]);
    await expect(
      prisma.outboxMessage.count({
        where: { tenantId, eventType: "product_initiative.handed_off" },
      }),
    ).resolves.toBe(1);
  });

  it("期望版本过期时冲突而不是覆盖", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide({ handoffId }, { outcome: "defer" }),
    });

    await expect(
      initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: decide({ handoffId }, { outcome: "defer" }),
      }),
    ).rejects.toThrowError(/PRODUCT_INITIATIVE_VERSION_CONFLICT/);
  });

  it("已立项的机会不再接受新的判断", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: completeApprove({ handoffId }),
    });

    await expect(
      initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: decide(
          { handoffId, expectedInitiativeVersion: 1 },
          { outcome: "reject", rejectReason: "改主意了" },
        ),
      }),
    ).rejects.toThrowError(/PRODUCT_INITIATIVE_ALREADY_APPROVED/);
  });

  it("机会不存在时明确失败", async () => {
    await expect(
      initiatives.persistDecision({
        tenantId: randomUUID(),
        handoffId: randomUUID(),
        actorId: "selector-1",
        command: decide({ handoffId: randomUUID() }, { outcome: "defer" }),
      }),
    ).rejects.toThrowError(/PRODUCT_INITIATIVE_OPPORTUNITY_NOT_FOUND/);
  });

  it("未接受的机会不能写入任何立项判断", async () => {
    const { tenantId, handoffId } = await seedOpportunity(false);
    await expect(
      initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: decide({ handoffId }, { outcome: "defer" }),
      }),
    ).rejects.toThrowError(/PRODUCT_INITIATIVE_NOT_ACCEPTED/);
    await expect(
      prisma.productInitiative.count({ where: { tenantId, handoffId } }),
    ).resolves.toBe(0);
  });

  it("从 queued/claimed/accepted 事实派生市场责任并拒绝跨租户读取", async () => {
    const queued = await seedOpportunity(false);
    const claimed = await seedOpportunity(false);
    const accepted = await seedOpportunity();
    const claimedAt = new Date("2026-10-04T00:10:00.000Z");
    await prisma.productOpportunityIntake.create({
      data: {
        id: randomUUID(),
        tenantId: claimed.tenantId,
        handoffId: claimed.handoffId,
        version: 1,
        state: "claimed",
        assignedActorId: "selector-claimed",
        actedBy: "selector-claimed",
        actedAt: claimedAt,
        idempotencyKey: `claim:${claimed.signalId}`,
        payloadHash: "c".repeat(64),
      },
    });

    const queuedView = toOpportunityV1(
      (
        await productOpportunities.list({
          tenantId: queued.tenantId,
          responsibilityStatus: "retained_by_market",
          take: 2,
        })
      )[0]!,
      null,
    );
    const claimedView = toOpportunityV1(
      (
        await productOpportunities.list({
          tenantId: claimed.tenantId,
          responsibilityStatus: "retained_by_market",
          take: 2,
        })
      )[0]!,
      null,
    );
    const acceptedRows = await productOpportunities.list({
      tenantId: accepted.tenantId,
      take: 2,
    });

    expect(queuedView.responsibility).toMatchObject({
      status: "retained_by_market",
      assignedActorId: null,
      claimedAt: null,
      acceptedAt: null,
    });
    expect(claimedView.responsibility).toMatchObject({
      status: "retained_by_market",
      assignedActorId: "selector-claimed",
      claimedAt: claimedAt.toISOString(),
      acceptedAt: null,
    });
    expect(
      toOpportunityV1(acceptedRows[0]!, null).responsibility,
    ).toMatchObject({
      status: "transferred_to_selection",
      responsibleTeamCode: "product_selection",
    });
    await expect(
      productOpportunities.list({
        tenantId: accepted.tenantId,
        responsibilityStatus: "retained_by_market",
        take: 2,
      }),
    ).resolves.toEqual([]);
    await expect(
      productOpportunities.list({
        tenantId: queued.tenantId,
        signalId: accepted.signalId,
        take: 2,
      }),
    ).resolves.toEqual([]);
  });

  it("退回请求与市场接回分两步且各自原子落库", async () => {
    const { tenantId, handoffId, signalId } = await seedOpportunity();
    await prisma.marketSignal.update({
      where: { id: signalId },
      data: {
        activeValidationOwnerActorId: "legacy-owner",
        activeValidationDueDate: new Date("2026-02-12T00:00:00.000Z"),
        activeValidationFocus: "遗留验证投影",
      },
    });

    const { record, duplicate } = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId },
        {
          outcome: "return_to_market",
          returnReason: "机会定义成了渠道问题",
          returnBasis: "wrong_direction",
        },
      ),
    });

    expect(duplicate).toBe(false);
    expect(record).toMatchObject({
      outcome: "return_to_market",
      completion: "completed",
      currentDestination: "return_requested",
      reason: "机会定义成了渠道问题",
      returnBasis: "wrong_direction",
    });

    const signal = await prisma.marketSignal.findFirstOrThrow({
      where: { id: signalId, tenantId },
    });
    expect(signal.currentDestination).toBe("selection_return_requested");
    expect(signal.activeValidationOwnerActorId).toBeNull();
    expect(signal.activeValidationDueDate).toBeNull();
    expect(signal.activeValidationFocus).toBeNull();
    expect(signal.activeValidationWaitingReason).toBeNull();

    const decision = await prisma.marketSignalDecision.findFirstOrThrow({
      where: {
        tenantId,
        signalId,
        decisionType: "selection_return_request",
      },
      orderBy: { decisionVersion: "desc" },
    });
    expect(decision).toMatchObject({
      completionState: "completed",
      judgmentNote: "机会定义成了渠道问题",
      returnBasis: "wrong_direction",
    });

    const handoff = await prisma.marketOpportunityHandoff.findFirstOrThrow({
      where: { id: handoffId, tenantId },
    });
    expect(handoff.isCurrent).toBe(true);
    expect(handoff.opportunityStatement).toBe("验证宠物出行机会是否值得立项。");

    expect(
      await marketSignals.findLatestSelectionReturn(tenantId, signalId),
    ).toEqual({ reason: "机会定义成了渠道问题", basis: "wrong_direction" });

    await expect(
      initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: decide(
          { handoffId, expectedInitiativeVersion: record.version },
          { outcome: "defer", deferReason: "改为暂缓" },
        ),
      }),
    ).rejects.toThrowError(/PRODUCT_INITIATIVE_RETURN_PENDING/);

    await expect(
      initiatives.takeBackSelectionReturn({
        tenantId,
        signalId,
        actorId: "market-owner",
        command: prepareSelectionReturnTakeback({
          contractVersion: "market-selection-return-takeback.v1",
          expectedSignalVersion: signal.version - 1,
          idempotencyKey: `takeback-stale:${signalId}`,
        }),
      }),
    ).rejects.toThrowError(/MARKET_SIGNAL_VERSION_CONFLICT/);
    await expect(
      prisma.productInitiative.findFirstOrThrow({
        where: { tenantId, handoffId },
      }),
    ).resolves.toMatchObject({ currentDestination: "return_requested" });
    await expect(
      prisma.marketSignal.findFirstOrThrow({
        where: { id: signalId, tenantId },
      }),
    ).resolves.toMatchObject({
      currentDestination: "selection_return_requested",
    });

    const takenBack = await initiatives.takeBackSelectionReturn({
      tenantId,
      signalId,
      actorId: "market-owner",
      command: prepareSelectionReturnTakeback({
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: signal.version,
        idempotencyKey: `takeback:${signalId}`,
      }),
    });
    expect(takenBack.record.currentDestination).toBe("returned_to_market");
    expect(takenBack.record.responsibleActorId).toBe("market-owner");
    const replay = await initiatives.takeBackSelectionReturn({
      tenantId,
      signalId,
      actorId: "market-owner",
      command: prepareSelectionReturnTakeback({
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: signal.version,
        idempotencyKey: `takeback:${signalId}`,
      }),
    });
    expect(replay.duplicate).toBe(true);
    await expect(
      prisma.marketSignal.findFirstOrThrow({
        where: { id: signalId, tenantId },
      }),
    ).resolves.toMatchObject({ currentDestination: "returned_from_selection" });
  });

  it("退回缺理由时保存但不关闭，也不回推信号", async () => {
    const { tenantId, handoffId, signalId } = await seedOpportunity();

    const { record } = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide({ handoffId }, { outcome: "return_to_market" }),
    });

    expect(record).toMatchObject({
      outcome: "return_to_market",
      completion: "pending_completion",
      currentDestination: "needs_decision",
    });

    const signal = await prisma.marketSignal.findFirstOrThrow({
      where: { id: signalId, tenantId },
    });
    expect(signal.currentDestination).toBe("handed_off");
    await expect(
      prisma.marketSignalDecision.count({
        where: { tenantId, signalId, decisionType: "selection_return_request" },
      }),
    ).resolves.toBe(0);
  });

  it("作废完成：信号进 voided，当前机会交接不再 is_current", async () => {
    const { tenantId, handoffId, signalId } = await seedOpportunity();
    const signal = await marketSignals.findById(tenantId, signalId);

    const closed = await marketSignals.decide({
      tenantId,
      actorId: "market-owner",
      signalId,
      evidenceRefs: [],
      prepared: prepareMarketSignalDecision(
        { ...signal!, evidenceRefs: [] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: signal!.version,
          decisionType: "void",
          judgmentNote: "重复登记，作废本条",
          idempotencyKey: `void:${signalId}`,
        },
      ),
    });

    expect(closed.signal.currentDestination).toBe("voided");
    const handoff = await prisma.marketOpportunityHandoff.findFirstOrThrow({
      where: { id: handoffId, tenantId },
    });
    expect(handoff.isCurrent).toBe(false);
    expect(handoff.opportunityStatement).toBe("验证宠物出行机会是否值得立项。");

    await expect(
      marketSignals.decide({
        tenantId,
        actorId: "market-owner",
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...closed.signal, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: closed.signal.version,
            decisionType: "archive",
            judgmentNote: "不应再推进",
            idempotencyKey: `archive-after-void:${signalId}`,
          },
        ),
      }),
    ).rejects.toThrowError(/MARKET_SIGNAL_ALREADY_CLOSED/);
  });

  it("归档缺理由时保存但不关闭，也不 supersede 交接", async () => {
    const { tenantId, handoffId, signalId } = await seedOpportunity();
    const signal = await marketSignals.findById(tenantId, signalId);

    const pending = await marketSignals.decide({
      tenantId,
      actorId: "market-owner",
      signalId,
      evidenceRefs: [],
      prepared: prepareMarketSignalDecision(
        { ...signal!, evidenceRefs: [] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: signal!.version,
          decisionType: "archive",
          idempotencyKey: `archive-pending:${signalId}`,
        },
      ),
    });

    expect(pending.decision.completion).toBe("pending_completion");
    expect(pending.signal.currentDestination).toBe("needs_decision");
    const handoff = await prisma.marketOpportunityHandoff.findFirstOrThrow({
      where: { id: handoffId, tenantId },
    });
    expect(handoff.isCurrent).toBe(true);
  });
});

async function seedOpportunity(accepted = true): Promise<{
  tenantId: string;
  handoffId: string;
  signalId: string;
}> {
  const tenantId = randomUUID();
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId,
    actorId: "market-owner",
    command: normalizeMarketSignalCreate({
      contractVersion: "market-signal-create.v1",
      requestId: signalId,
      title: "加拿大站宠物出行需求上升",
      marketCode: "CA",
      idempotencyKey: `create:${signalId}`,
    }),
  });
  const decided = await marketSignals.decide({
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
        opportunityStatement: "验证宠物出行机会是否值得立项。",
        idempotencyKey: `handoff:${signalId}`,
      },
    ),
  });
  if (accepted) {
    await prisma.productOpportunityIntake.create({
      data: {
        id: randomUUID(),
        tenantId,
        handoffId: decided.handoff!.handoffId,
        version: 1,
        state: "accepted",
        assignedActorId: "selector-1",
        actedBy: "selector-1",
        actedAt: new Date(),
        idempotencyKey: `accept:${signalId}`,
        payloadHash: "a".repeat(64),
      },
    });
  }
  return { tenantId, handoffId: decided.handoff!.handoffId, signalId };
}

function decide(
  current: { handoffId: string; expectedInitiativeVersion?: number },
  overrides: Partial<ProductInitiativeDecisionCommandV1> = {},
) {
  const requestId = randomUUID();
  return prepareProductInitiativeDecision(
    { version: current.expectedInitiativeVersion ?? 0 },
    "selector-1",
    {
      contractVersion: "product-initiative-decision.v1",
      requestId,
      outcome: "defer",
      expectedInitiativeVersion: current.expectedInitiativeVersion ?? 0,
      idempotencyKey: `decision:${requestId}`,
      reviewPoints: [],
      ...overrides,
    } as ProductInitiativeDecisionCommandV1,
  );
}

function completeApprove(current: { handoffId: string }) {
  return decide(current, {
    outcome: "approve",
    objective: "把折叠宠物出行包做成可发布版本",
    reviewPoints: REVIEW_POINT_CODES.map((code, index) => ({
      code,
      evidenceRefs: [evidenceId(index)],
      conclusion: `${code} 的结论`,
    })),
  });
}

function evidenceId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
