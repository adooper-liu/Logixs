import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "../../../../../generated/prisma";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import { prepareOpportunityIntake } from "../../modules/product-selection/domain/product-opportunity";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

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
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
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

  it("persists one self-owned active validation and rejects silent takeover", async () => {
    const tenantId = randomUUID();
    const signalId = randomUUID();
    const created = await marketSignals.create({
      tenantId,
      actorId: "market-owner-a",
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: signalId,
        title: "[合成演练] 春季户外收纳窗口提前",
        idempotencyKey: `create:${signalId}`,
      }),
    });
    const firstCommand = prepareMarketSignalDecision(
      { ...created.record, evidenceRefs: [] },
      {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: 1,
        decisionType: "watch",
        nextReviewDate: "2026-02-12",
        watchFocus: "确认趋势是否持续两周",
        waitingReason: "等待第二客服队列",
        idempotencyKey: `watch:${signalId}:1`,
      },
    );

    const first = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: [],
      prepared: firstCommand,
    });
    const replay = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: [],
      prepared: firstCommand,
    });

    expect(first).toMatchObject({
      duplicate: false,
      signal: {
        currentDestination: "watching",
        activeValidation: {
          responsibleActorId: "market-owner-a",
          nextReviewDate: "2026-02-12",
          watchFocus: "确认趋势是否持续两周",
          waitingReason: "等待第二客服队列",
        },
      },
    });
    expect(replay).toMatchObject({
      duplicate: true,
      signal: { activeValidation: first.signal.activeValidation },
    });
    await expect(
      marketSignals.decide({
        tenantId,
        actorId: "market-owner-b",
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...first.signal, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: first.signal.version,
            decisionType: "watch",
            nextReviewDate: "2026-02-19",
            watchFocus: "确认客户痛点是否重复",
            idempotencyKey: `watch:${signalId}:takeover`,
          },
        ),
      }),
    ).rejects.toThrow("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT");

    const rescheduled = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: [],
      prepared: prepareMarketSignalDecision(
        { ...first.signal, evidenceRefs: [] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: first.signal.version,
          decisionType: "watch",
          nextReviewDate: "2026-02-19",
          watchFocus: "确认客户痛点是否重复",
          idempotencyKey: `watch:${signalId}:2`,
        },
      ),
    });
    expect(rescheduled.signal.activeValidation).toMatchObject({
      responsibleActorId: "market-owner-a",
      nextReviewDate: "2026-02-19",
      watchFocus: "确认客户痛点是否重复",
      waitingReason: null,
    });
    await expect(
      prisma.marketSignalDecision.count({ where: { tenantId, signalId } }),
    ).resolves.toBe(2);

    const pendingWatch = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: [],
      prepared: prepareMarketSignalDecision(
        { ...rescheduled.signal, evidenceRefs: [] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: rescheduled.signal.version,
          decisionType: "watch",
          nextReviewDate: "2026-02-26",
          idempotencyKey: `watch:${signalId}:pending`,
        },
      ),
    });
    expect(pendingWatch.signal.activeValidation).toEqual(
      rescheduled.signal.activeValidation,
    );

    const dismissed = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: [],
      prepared: prepareMarketSignalDecision(
        { ...pendingWatch.signal, evidenceRefs: [] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: pendingWatch.signal.version,
          decisionType: "dismiss",
          dismissReason: "短期峰值，不进入选品",
          idempotencyKey: `dismiss:${signalId}`,
        },
      ),
    });
    expect(dismissed.signal.activeValidation).toBeNull();
    await expect(
      prisma.marketSignalDecision.count({ where: { tenantId, signalId } }),
    ).resolves.toBe(4);
  });

  it("rejects two-step takeover, cross-actor replay and racing writes on a live commitment", async () => {
    const tenantId = randomUUID();
    const { signalId, watched, watchCommand } = await watchedSignal(
      tenantId,
      "market-owner-a",
    );
    const decideAs = (
      actorId: string,
      command: Parameters<typeof prepareMarketSignalDecision>[1],
      basis = watched.signal,
    ) =>
      marketSignals.decide({
        tenantId,
        actorId,
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...basis, evidenceRefs: [] },
          command,
        ),
      });
    const base = {
      contractVersion: "market-signal-decision.v1" as const,
      expectedSignalVersion: watched.signal.version,
    };

    for (const [decisionType, extra] of [
      ["dismiss", { dismissReason: "他人直接不采纳" }],
      ["void", { judgmentNote: "他人直接作废" }],
      ["archive", { judgmentNote: "他人直接归档" }],
      ["handoff", { opportunityStatement: "他人直接交选品" }],
    ] as const) {
      await expect(
        decideAs("market-owner-b", {
          ...base,
          decisionType,
          ...extra,
          idempotencyKey: `${decisionType}:${signalId}:b`,
        }),
      ).rejects.toThrow("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT");
    }
    await expect(
      marketSignals.decide({
        tenantId,
        actorId: "market-owner-b",
        signalId,
        evidenceRefs: [],
        prepared: watchCommand,
      }),
    ).rejects.toThrow("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT");

    // pending 退出不清空承诺，他人随后仍不能自领。
    const pendingExit = await decideAs("market-owner-b", {
      ...base,
      decisionType: "dismiss",
      idempotencyKey: `dismiss:${signalId}:b-pending`,
    });
    expect(pendingExit.decision.completion).toBe("pending_completion");
    expect(pendingExit.signal.activeValidation).toEqual(
      watched.signal.activeValidation,
    );
    await expect(
      decideAs(
        "market-owner-b",
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: pendingExit.signal.version,
          decisionType: "watch",
          nextReviewDate: "2026-03-01",
          watchFocus: "他人自领",
          idempotencyKey: `watch:${signalId}:b-claim`,
        },
        pendingExit.signal,
      ),
    ).rejects.toThrow("MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT");

    const latest = pendingExit.signal;
    await expect(
      decideAs(
        "market-owner-a",
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: latest.version,
          decisionType: "watch",
          nextReviewDate: "2026-03-05",
          watchFocus: "同键不同载荷",
          idempotencyKey: watchCommand.idempotencyKey,
        },
        latest,
      ),
    ).rejects.toThrow("MARKET_SIGNAL_DECISION_IDEMPOTENCY_CONFLICT");

    const racing = await Promise.allSettled(
      ["2026-03-10", "2026-03-11"].map((date, index) =>
        decideAs(
          "market-owner-a",
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: latest.version,
            decisionType: "watch",
            nextReviewDate: date,
            watchFocus: `并发改期 ${index}`,
            idempotencyKey: `watch:${signalId}:race:${index}`,
          },
          latest,
        ),
      ),
    );
    expect(racing.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      racing.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )?.reason,
    ).toMatchObject({ message: "MARKET_SIGNAL_VERSION_CONFLICT" });
    await expect(
      prisma.marketSignalDecision.count({ where: { tenantId, signalId } }),
    ).resolves.toBe(3);
  });

  it("replays an earlier key with its own coherent result after a later decision", async () => {
    const tenantId = randomUUID();
    const { signalId, watched, watchCommand } = await watchedSignal(
      tenantId,
      "market-owner-a",
    );
    const second = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: ["evidence-added-later"],
      prepared: prepareMarketSignalDecision(
        { ...watched.signal, evidenceRefs: ["evidence-added-later"] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: watched.signal.version,
          decisionType: "watch",
          nextReviewDate: "2026-04-01",
          watchFocus: "第二次改期",
          idempotencyKey: `watch:${signalId}:k2`,
        },
      ),
    });
    expect(second.signal.version).toBe(watched.signal.version + 1);

    const replayK1 = await marketSignals.decide({
      tenantId,
      actorId: "market-owner-a",
      signalId,
      evidenceRefs: ["evidence-added-later"],
      prepared: watchCommand,
    });
    expect(replayK1).toMatchObject({
      duplicate: true,
      decision: { id: watched.decision.id, version: watched.decision.version },
      evidenceRefs: [],
      signal: {
        version: watched.signal.version,
        activeValidation: watched.signal.activeValidation,
      },
    });
    expect(replayK1.signal.updatedAt).toEqual(watched.signal.updatedAt);

    // 升级前的判断没有结果快照，也没有当时的 evidence 快照；即使信号版本未前进，
    // 也不能把重试时的 evidence 混入历史结果，必须稳定拒绝重放。
    await prisma.marketSignalDecision.updateMany({
      where: { tenantId, signalId },
      data: {
        resultSignalSnapshot: Prisma.DbNull,
        // 模拟升级前由旧算法生成、与当前 request-only hash 不同的历史值。
        payloadHash: "f".repeat(64),
      },
    });
    await expect(
      marketSignals.decide({
        tenantId,
        actorId: "market-owner-a",
        signalId,
        evidenceRefs: ["evidence-replaced-without-signal-version-change"],
        prepared: prepareMarketSignalDecision(
          { ...watched.signal, evidenceRefs: ["evidence-added-later"] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: watched.signal.version,
            decisionType: "watch",
            nextReviewDate: "2026-04-01",
            watchFocus: "第二次改期",
            idempotencyKey: `watch:${signalId}:k2`,
          },
        ),
      }),
    ).rejects.toThrow("MARKET_SIGNAL_DECISION_REPLAY_SUPERSEDED");
    await expect(
      marketSignals.decide({
        tenantId,
        actorId: "market-owner-a",
        signalId,
        evidenceRefs: [],
        prepared: watchCommand,
      }),
    ).rejects.toThrow("MARKET_SIGNAL_DECISION_REPLAY_SUPERSEDED");
  });

  it("returns a stable conflict when the same tenant key races across two signals", async () => {
    const tenantId = randomUUID();
    const actorId = "market-owner";
    const first = await marketSignals.create({
      tenantId,
      actorId,
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: randomUUID(),
        title: "跨信号同键一",
        idempotencyKey: `create:${randomUUID()}`,
      }),
    });
    const second = await marketSignals.create({
      tenantId,
      actorId,
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: randomUUID(),
        title: "跨信号同键二",
        idempotencyKey: `create:${randomUUID()}`,
      }),
    });
    const idempotencyKey = `decision:${randomUUID()}`;
    const attempts = [first.record, second.record].map((record) =>
      marketSignals.decide({
        tenantId,
        actorId,
        signalId: record.id,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...record, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: record.version,
            decisionType: "watch",
            nextReviewDate: "2026-05-01",
            watchFocus: "验证跨信号同键竞态",
            idempotencyKey,
          },
        ),
      }),
    );

    const results = await Promise.allSettled(attempts);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({
      message: "MARKET_SIGNAL_DECISION_IDEMPOTENCY_CONFLICT",
    });
    await expect(
      prisma.marketSignalDecision.count({
        where: { tenantId, idempotencyKey },
      }),
    ).resolves.toBe(1);
  });

  it("serializes ordinary decisions and selection returns on the same tenant key", async () => {
    const tenantId = randomUUID();
    const actorId = "market-owner";
    const ordinary = await marketSignals.create({
      tenantId,
      actorId,
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: randomUUID(),
        title: "普通判断信号",
        idempotencyKey: `create:${randomUUID()}`,
      }),
    });
    const returned = await marketSignals.create({
      tenantId,
      actorId,
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: randomUUID(),
        title: "选品退回信号",
        idempotencyKey: `create:${randomUUID()}`,
      }),
    });
    await prisma.marketSignal.update({
      where: { id: returned.record.id },
      data: { currentDestination: "handed_off" },
    });
    const idempotencyKey = `cross-path:${randomUUID()}`;

    const results = await Promise.allSettled([
      marketSignals.decide({
        tenantId,
        actorId,
        signalId: ordinary.record.id,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...ordinary.record, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: ordinary.record.version,
            decisionType: "watch",
            nextReviewDate: "2026-05-02",
            watchFocus: "验证普通路径",
            idempotencyKey,
          },
        ),
      }),
      prisma.$transaction((tx) =>
        marketSignals.applySelectionReturnWithin(tx, {
          tenantId,
          signalId: returned.record.id,
          actorId: "selector",
          returnReason: "交叉路径同键竞态",
          returnBasis: "wrong_direction",
          idempotencyKey,
        }),
      ),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({
      message: "MARKET_SIGNAL_DECISION_IDEMPOTENCY_CONFLICT",
    });
    await expect(
      prisma.marketSignalDecision.count({
        where: { tenantId, idempotencyKey },
      }),
    ).resolves.toBe(1);
  });

  it("orders watching rows by due date with missing due dates last", async () => {
    const tenantId = randomUUID();
    const late = await watchedSignal(tenantId, "market-owner", "2026-05-20");
    const early = await watchedSignal(tenantId, "market-owner", "2026-05-01");
    const sameDayOlder = await watchedSignal(
      tenantId,
      "market-owner",
      "2026-05-10",
    );
    const sameDayNewer = await watchedSignal(
      tenantId,
      "market-owner",
      "2026-05-10",
    );
    const legacy = await watchedSignal(tenantId, "market-owner", "2026-04-01");
    // 模拟升级前没有 completed watch 可回填的旧 watching 行。
    await prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}"."market_signal"
       SET "active_validation_owner_actor_id" = NULL,
           "active_validation_due_date" = NULL,
           "active_validation_focus" = NULL,
           "active_validation_waiting_reason" = NULL
       WHERE "id" = $1::uuid`,
      legacy.signalId,
    );

    const rows = await marketSignals.list({
      tenantId,
      destination: "watching",
      take: 10,
    });
    expect(rows.map(({ id }) => id)).toEqual([
      early.signalId,
      sameDayNewer.signalId,
      sameDayOlder.signalId,
      late.signalId,
      legacy.signalId,
    ]);
    expect(rows.at(-1)?.activeValidation).toBeNull();
  });

  it.each([
    ["handoff", { opportunityStatement: "交给选品评估" }],
    ["dismiss", { dismissReason: "不进入选品" }],
    ["void", { judgmentNote: "重复登记" }],
    ["archive", { judgmentNote: "观察结束" }],
  ] as const)(
    "clears the current validation when a completed %s decision takes effect",
    async (decisionType, extra) => {
      const tenantId = randomUUID();
      const signalId = randomUUID();
      const created = await marketSignals.create({
        tenantId,
        actorId: "market-owner",
        command: normalizeMarketSignalCreate({
          contractVersion: "market-signal-create.v1",
          requestId: signalId,
          title: `[清理投影] ${decisionType}`,
          idempotencyKey: `create:${signalId}`,
        }),
      });
      const watched = await marketSignals.decide({
        tenantId,
        actorId: "market-owner",
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...created.record, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: 1,
            decisionType: "watch",
            nextReviewDate: "2026-02-12",
            watchFocus: "验证当前承诺清理",
            idempotencyKey: `watch:${signalId}`,
          },
        ),
      });
      expect(watched.signal.activeValidation).not.toBeNull();

      const exited = await marketSignals.decide({
        tenantId,
        actorId: "market-owner",
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...watched.signal, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: watched.signal.version,
            decisionType,
            ...extra,
            idempotencyKey: `${decisionType}:${signalId}`,
          },
        ),
      });

      expect(exited.decision.completion).toBe("completed");
      expect(exited.signal.activeValidation).toBeNull();
      await expect(
        prisma.marketSignalDecision.count({ where: { tenantId, signalId } }),
      ).resolves.toBe(2);
    },
  );

  it("keeps needs-decision reachable while paging more than 100 watching rows by due date", async () => {
    const tenantId = randomUUID();
    const watchedIds: string[] = [];
    for (let index = 0; index < 101; index += 1) {
      const signalId = randomUUID();
      const created = await marketSignals.create({
        tenantId,
        actorId: "market-owner",
        command: normalizeMarketSignalCreate({
          contractVersion: "market-signal-create.v1",
          requestId: signalId,
          title: `[合成分页] 验证信号 ${index}`,
          idempotencyKey: `create:${signalId}`,
        }),
      });
      await marketSignals.decide({
        tenantId,
        actorId: "market-owner",
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...created.record, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: 1,
            decisionType: "watch",
            nextReviewDate: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
            watchFocus: `验证重点 ${index}`,
            idempotencyKey: `watch:${signalId}`,
          },
        ),
      });
      watchedIds.push(signalId);
    }
    const pendingId = randomUUID();
    await marketSignals.create({
      tenantId,
      actorId: "market-owner",
      command: normalizeMarketSignalCreate({
        contractVersion: "market-signal-create.v1",
        requestId: pendingId,
        title: "不能被观察队列挤出的待判断信号",
        idempotencyKey: `create:${pendingId}`,
      }),
    });

    const pending = await marketSignals.list({
      tenantId,
      destination: "needs_decision",
      take: 10,
    });
    expect(pending.map(({ id }) => id)).toContain(pendingId);

    const seen = new Set<string>();
    let after: Parameters<typeof marketSignals.list>[0]["after"];
    do {
      const page = await marketSignals.list({
        tenantId,
        destination: "watching",
        take: 25,
        ...(after ? { after } : {}),
      });
      page.forEach((row) => seen.add(row.id));
      const last = page.at(-1);
      after =
        page.length === 25 && last
          ? {
              sort: "watching_due",
              activeValidationDueDate: last.activeValidation
                ? new Date(
                    `${last.activeValidation.nextReviewDate}T00:00:00.000Z`,
                  )
                : null,
              updatedAt: last.updatedAt,
              id: last.id,
            }
          : undefined;
    } while (after);

    expect(seen).toEqual(new Set(watchedIds));
  }, 120_000);

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

async function watchedSignal(
  tenantId: string,
  actorId: string,
  nextReviewDate = "2026-02-12",
) {
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId,
    actorId,
    command: normalizeMarketSignalCreate({
      contractVersion: "market-signal-create.v1",
      requestId: signalId,
      title: `[合成演练] 当前验证 ${signalId}`,
      idempotencyKey: `create:${signalId}`,
    }),
  });
  const watchCommand = prepareMarketSignalDecision(
    { ...created.record, evidenceRefs: [] },
    {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "watch",
      nextReviewDate,
      watchFocus: "确认趋势是否持续两周",
      idempotencyKey: `watch:${signalId}:k1`,
    },
  );
  const watched = await marketSignals.decide({
    tenantId,
    actorId,
    signalId,
    evidenceRefs: [],
    prepared: watchCommand,
  });
  return { signalId, watched, watchCommand };
}

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
