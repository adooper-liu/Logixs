import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { ReadEvidenceRefsService } from "../../modules/document-records/application/read-evidence-refs.service";
import { PrismaEvidenceRepository } from "../../modules/document-records/infrastructure/prisma-evidence.repository";
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
import { prepareProductDefinitionClaim } from "../../modules/product-selection/domain/product-initiative-claim";
import { prepareProductInitiativeNpiReturn } from "../../modules/product-selection/domain/product-initiative-npi-return";
import { DecideProductInitiativeService } from "../../modules/product-selection/application/decide-product-initiative.service";
import { PrismaProductInitiativeRepository } from "../../modules/product-selection/infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";
import { toOpportunityV1 } from "../../modules/product-selection/application/list-product-opportunities.service";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { PrismaReferenceCurrencyDirectory } from "../../modules/master-data/infrastructure/prisma-reference-currency-directory";

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
let decideInitiatives: DecideProductInitiativeService;

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
  await seedActiveCurrency();
  marketSignals = new PrismaMarketSignalRepository(prisma as never);
  const applySelectionReturn = new ApplySelectionReturnService(marketSignals);
  initiatives = new PrismaProductInitiativeRepository(
    prisma as never,
    applySelectionReturn,
  );
  productOpportunities = new PrismaProductOpportunityRepository(
    prisma as never,
  );
  decideInitiatives = new DecideProductInitiativeService(
    initiatives,
    productOpportunities,
    new ReadEvidenceRefsService(new PrismaEvidenceRepository(prisma as never)),
    new PrismaReferenceCurrencyDirectory(prisma as never),
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
  it("只引用当前租户当前来源信号的真实证据时可立项", async () => {
    const opportunity = await seedOpportunity();
    const evidenceId = await seedSignalEvidence(
      opportunity.tenantId,
      opportunity.signalId,
    );

    const result = await decideInitiatives.execute({
      tenantId: opportunity.tenantId,
      actorId: "selector-1",
      handoffId: opportunity.handoffId,
      command: completeApproveCommand(evidenceId),
    });

    expect(result.currentDestination).toBe("handed_off");
    await expect(
      prisma.productInitiativeHandoff.findFirstOrThrow({
        where: {
          tenantId: opportunity.tenantId,
          initiativeId: result.initiativeId,
        },
      }),
    ).resolves.toMatchObject({ evidenceRefs: [evidenceId] });
  });

  it.each([
    ["不存在", "ZZZ", "CURRENCY_UNKNOWN: ZZZ"],
    ["非 active", "EUR", "CURRENCY_INACTIVE: EUR"],
  ] as const)(
    "%s币种明确拒绝且不写立项",
    async (_label, currencyCode, message) => {
      const opportunity = await seedOpportunity();
      const evidenceId = await seedSignalEvidence(
        opportunity.tenantId,
        opportunity.signalId,
      );
      if (currencyCode === "EUR") await seedInactiveCurrency();
      const unitEconomicsDraft = completeUnitEconomicsDraft();
      unitEconomicsDraft.currencyCode = currencyCode;

      await expect(
        decideInitiatives.execute({
          tenantId: opportunity.tenantId,
          actorId: "selector-1",
          handoffId: opportunity.handoffId,
          command: {
            ...completeApproveCommand(evidenceId),
            unitEconomicsDraft,
          },
        }),
      ).rejects.toMatchObject({ status: 400, message });
      await expect(
        prisma.productInitiative.count({
          where: {
            tenantId: opportunity.tenantId,
            handoffId: opportunity.handoffId,
          },
        }),
      ).resolves.toBe(0);
    },
  );

  it("拒绝同租户其他来源信号的证据且不写任何立项事实", async () => {
    const opportunity = await seedOpportunity();
    const other = await seedOpportunity(true, opportunity.tenantId);
    const evidenceId = await seedSignalEvidence(other.tenantId, other.signalId);

    await expectEvidenceRejected(opportunity, evidenceId);
  });

  it("拒绝跨租户证据且不泄露归属、不写任何立项事实", async () => {
    const opportunity = await seedOpportunity();
    const other = await seedOpportunity();
    const evidenceId = await seedSignalEvidence(other.tenantId, other.signalId);

    await expectEvidenceRejected(opportunity, evidenceId);
  });

  it("拒绝完全不存在的证据且不写任何立项事实", async () => {
    const opportunity = await seedOpportunity();

    await expectEvidenceRejected(opportunity, randomUUID());
  });

  it("单位经济引用不属于当前机会的证据时原子拒绝", async () => {
    const opportunity = await seedOpportunity();
    const other = await seedOpportunity(true, opportunity.tenantId);
    const invalidEvidenceId = await seedSignalEvidence(
      other.tenantId,
      other.signalId,
    );
    const validEvidenceId = await seedSignalEvidence(
      opportunity.tenantId,
      opportunity.signalId,
    );

    await expect(
      decideInitiatives.execute({
        tenantId: opportunity.tenantId,
        actorId: "selector-1",
        handoffId: opportunity.handoffId,
        command: {
          ...completeApproveCommand(validEvidenceId),
          unitEconomicsDraft: completeUnitEconomicsDraft(invalidEvidenceId),
        },
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: `PRODUCT_INITIATIVE_EVIDENCE_INVALID: ${invalidEvidenceId}`,
    });
    await expect(
      prisma.productInitiative.count({
        where: {
          tenantId: opportunity.tenantId,
          handoffId: opportunity.handoffId,
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.productInitiativeHandoff.count({
        where: { tenantId: opportunity.tenantId },
      }),
    ).resolves.toBe(0);
  });

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
    expect(record.pendingFieldCodes).toContain("validation_focus");
    expect(record.pendingFieldCodes).toContain("reconsideration_date");
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

  it("非立项结果保留部分单位经济草稿但不生成完整快照", async () => {
    const { tenantId, handoffId } = await seedOpportunity();

    const { record } = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId },
        {
          outcome: "defer",
          unitEconomicsDraft: {
            channelCode: "amazon",
            currencyCode: "USD",
            scenarios: { baseline: { salePrice: { min: "20" } } },
          },
        },
      ),
    });

    expect(record.unitEconomicsDraft).toMatchObject({
      marketCode: "CA",
      channelCode: "amazon",
      currencyCode: "USD",
      scenarios: { baseline: { salePrice: { min: "20" } } },
    });
    expect(record.unitEconomicsSnapshot).toBeNull();
    expect(record.pendingFieldCodes).toContain(
      "unitEconomics.scenarios.baseline.salePrice.max",
    );
  });

  it.each([
    [
      "defer",
      {
        outcome: "defer",
        validationFocus: "核实负贡献假设",
        reconsiderationDate: "2026-10-20",
      },
    ],
    ["reject", { outcome: "reject", rejectReason: "保守情景不值得投入" }],
    [
      "return_to_market",
      {
        outcome: "return_to_market",
        returnReason: "市场事实仍不足",
        returnBasis: "insufficient_evidence",
      },
    ],
  ] as const)(
    "完整负贡献单位经济无理由时允许 %s 保存待补快照",
    async (_label, outcomeFields) => {
      const { tenantId, handoffId } = await seedOpportunity();

      const { record } = await initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: decide(
          { handoffId },
          {
            ...outcomeFields,
            unitEconomicsDraft: negativeConservativeUnitEconomicsDraft(),
          },
        ),
      });

      expect(record.unitEconomicsDraft).not.toBeNull();
      expect(record.unitEconomicsSnapshot).toMatchObject({
        scenarios: {
          conservative: { contribution: { min: "-5", max: "25" } },
        },
      });
      expect(record.negativeConservativeReason).toBeNull();
      expect(record.pendingFieldCodes).toContain("negativeConservativeReason");
      await expect(
        prisma.productInitiativeHandoff.count({ where: { tenantId } }),
      ).resolves.toBe(0);
    },
  );

  it("完整负贡献单位经济无理由时拒绝立项", async () => {
    const { handoffId } = await seedOpportunity();

    expect(() =>
      decide(
        { handoffId },
        {
          outcome: "approve",
          objective: "把折叠宠物出行包做成可发布版本",
          acceptResponsibility: true,
          receivingTeamOrRole: "产品开发 / NPI",
          resourceDescription: "结构工程 1 人，采购验证 1 人",
          targetDate: "2026-11-15",
          nextDecisionDate: "2026-10-20",
          nextDecisionQuestion: "是否进入 EVT 打样",
          reviewPoints: REVIEW_POINT_CODES.map((code, index) => ({
            code,
            evidenceRefs: [evidenceId(index)],
            conclusion: `${code} 的结论`,
          })),
          unitEconomicsDraft: negativeConservativeUnitEconomicsDraft(),
        },
      ),
    ).toThrow("PRODUCT_INITIATIVE_INCOMPLETE: negativeConservativeReason");
  });

  it("币种目录只把 SIX 的同名数据集视为权威", async () => {
    const untrustedReleaseId = randomUUID();
    await prisma.referenceDataRelease.create({
      data: {
        id: untrustedReleaseId,
        authority: "UNTRUSTED TEST AUTHORITY",
        datasetCode: "ISO_4217_LIST_ONE",
        version: `untrusted-${randomUUID()}`,
        publishedAt: new Date("2026-09-17T00:00:00.000Z"),
        sourceUrl: "https://untrusted.invalid/list-one.xml",
        retrievedAt: new Date("2026-10-04T00:00:00.000Z"),
        sourceSha256: "d".repeat(64),
        recordsSha256: "e".repeat(64),
        license: "integration test fixture",
        status: "active",
        currencyCodes: {
          create: {
            id: randomUUID(),
            alphaCode: "ZZZ",
            numericCode: "999",
            minorUnit: 2,
            currencyName: "Untrusted Currency",
            sourceRowHash: "f".repeat(64),
          },
        },
      },
    });

    try {
      const directory = new PrismaReferenceCurrencyDirectory(prisma as never);
      await expect(directory.listActive()).resolves.toEqual([
        expect.objectContaining({ alphaCode: "USD" }),
      ]);
      await expect(directory.resolve("ZZZ")).resolves.toEqual({
        status: "unknown",
        currency: null,
      });
    } finally {
      await prisma.currencyCodeReference.deleteMany({
        where: { releaseId: untrustedReleaseId },
      });
      await prisma.referenceDataRelease.delete({
        where: { id: untrustedReleaseId },
      });
    }
  });

  it.each([
    [
      "验证重点",
      {
        validationFocus: "核实大促后的真实转化",
        reconsiderationDate: undefined,
      },
      "reconsideration_date",
    ],
    [
      "重判日期",
      { validationFocus: undefined, reconsiderationDate: "2026-10-20" },
      "validation_focus",
    ],
  ] as const)(
    "暂缓只填%s时仍可持久化为待补",
    async (_label, partial, missingCode) => {
      const { tenantId, handoffId } = await seedOpportunity();

      const { record } = await initiatives.persistDecision({
        tenantId,
        handoffId,
        actorId: "selector-1",
        command: decide({ handoffId }, { outcome: "defer", ...partial }),
      });

      expect(record).toMatchObject({
        outcome: "defer",
        completion: "pending_completion",
        currentDestination: "needs_decision",
        reason: null,
      });
      expect(record.validationFocus).toEqual(partial.validationFocus ?? null);
      expect(
        record.reconsiderationDate?.toISOString().slice(0, 10) ?? null,
      ).toBe(partial.reconsiderationDate ?? null);
      expect(record.pendingFieldCodes).toContain(missingCode);
    },
  );

  it("同一幂等键重放返回同一结果且不新增行", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    const command = decide(
      { handoffId },
      {
        outcome: "defer",
        validationFocus: "等大促后重看竞争供给",
        reconsiderationDate: "2026-10-20",
      },
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
          acceptResponsibility: true,
          receivingTeamOrRole: "产品开发 / NPI",
          resourceDescription: "结构工程 1 人，采购验证 1 人",
          targetDate: "2026-11-15",
          nextDecisionDate: "2026-10-20",
          nextDecisionQuestion: "是否进入 EVT 打样",
          unitEconomicsDraft: completeUnitEconomicsDraft(),
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
      responsibilityAccepted: true,
      receivingTeamOrRole: "产品开发 / NPI",
      resourceDescription: "结构工程 1 人，采购验证 1 人",
      targetDate: new Date("2026-11-15T00:00:00.000Z"),
      nextDecisionDate: new Date("2026-10-20T00:00:00.000Z"),
      nextDecisionQuestion: "是否进入 EVT 打样",
      marketCode: "CA",
      userProblem: "验证宠物出行机会是否值得立项。",
      unitEconomicsSnapshot: expect.objectContaining({
        marketCode: "CA",
        channelCode: "amazon",
        currencyCode: "USD",
      }),
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

  it("完整立项经 NPI 领取后可退回选品，保留当前承诺且不改快照", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    const approved = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: completeApprove({ handoffId }),
    });
    const snapshotBefore =
      await prisma.productInitiativeHandoff.findFirstOrThrow({
        where: { tenantId, initiativeId: approved.record.initiativeId },
      });

    await initiatives.appendClaim({
      tenantId,
      handoffId: snapshotBefore.id,
      command: prepareProductDefinitionClaim(
        "npi-owner",
        `claim-for-return:${snapshotBefore.id}`,
      ),
    });
    const returned = await initiatives.persistNpiReturn({
      tenantId,
      initiativeHandoffId: snapshotBefore.id,
      actorId: "npi-owner",
      command: prepareProductInitiativeNpiReturn(
        {
          version: approved.record.version,
          currentDestination: approved.record.currentDestination,
          productOwnerActorId: "npi-owner",
        },
        "npi-owner",
        {
          contractVersion: "product-initiative-npi-return.v1",
          expectedInitiativeVersion: approved.record.version,
          returnReason: "工程验证发现结构方案需要重判",
          idempotencyKey: `npi-return:${snapshotBefore.id}`,
        },
      ),
    });

    expect(returned.record).toMatchObject({
      outcome: "returned_from_npi",
      currentDestination: "returned_from_npi",
      responsibilityAccepted: true,
      receivingTeamOrRole: "产品开发 / NPI",
      resourceDescription: "结构工程 1 人，采购验证 1 人",
      targetDate: new Date("2026-11-15T00:00:00.000Z"),
      nextDecisionDate: new Date("2026-10-20T00:00:00.000Z"),
      nextDecisionQuestion: "是否进入 EVT 打样",
      unitEconomicsSnapshot: expect.objectContaining({
        currencyCode: "USD",
      }),
    });
    await expect(
      prisma.productInitiativeHandoff.findUniqueOrThrow({
        where: { id: snapshotBefore.id },
      }),
    ).resolves.toEqual(snapshotBefore);
  });

  it("除立项与 NPI 退回外，其他结果仍不能携带资源承诺", async () => {
    const { tenantId, handoffId } = await seedOpportunity();
    const approved = await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: completeApprove({ handoffId }),
    });

    await expect(
      prisma.productInitiative.update({
        where: { id: approved.record.initiativeId },
        data: {
          outcome: "reject",
          currentDestination: "rejected",
          reason: "不进入本轮",
        },
      }),
    ).rejects.toThrow(/product_initiative_resource_commitment_shape_check/);
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

  it("暂缓到期项排在普通项之前，并按重判日期稳定翻页", async () => {
    const firstOpportunity = await seedOpportunity();
    const secondOpportunity = await seedOpportunity(
      true,
      firstOpportunity.tenantId,
    );
    const standardOpportunity = await seedOpportunity(
      true,
      firstOpportunity.tenantId,
    );
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = addUtcDays(today, 1);
    const projectionDay = new Date(`${addUtcDays(today, 2)}T00:00:00.000Z`);

    const first = await initiatives.persistDecision({
      tenantId: firstOpportunity.tenantId,
      handoffId: firstOpportunity.handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId: firstOpportunity.handoffId },
        {
          outcome: "defer",
          validationFocus: "先验证样本 A",
          reconsiderationDate: today,
        },
      ),
    });
    const second = await initiatives.persistDecision({
      tenantId: secondOpportunity.tenantId,
      handoffId: secondOpportunity.handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId: secondOpportunity.handoffId },
        {
          outcome: "defer",
          validationFocus: "再验证样本 B",
          reconsiderationDate: tomorrow,
        },
      ),
    });
    const standard = await initiatives.persistDecision({
      tenantId: standardOpportunity.tenantId,
      handoffId: standardOpportunity.handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId: standardOpportunity.handoffId },
        { outcome: "reject", rejectReason: "不进入本轮" },
      ),
    });

    const page = await initiatives.list({
      tenantId: firstOpportunity.tenantId,
      todayUtc: projectionDay,
      take: 3,
    });
    expect(page.map((row) => row.initiativeId)).toEqual([
      first.record.initiativeId,
      second.record.initiativeId,
      standard.record.initiativeId,
    ]);
    const next = await initiatives.list({
      tenantId: firstOpportunity.tenantId,
      todayUtc: projectionDay,
      after: {
        group: "defer_reconsideration_due",
        reconsiderationDate: first.record.reconsiderationDate,
        updatedAt: first.record.updatedAt,
        id: first.record.initiativeId,
      },
      take: 1,
    });
    expect(next.map((row) => row.initiativeId)).toEqual([
      second.record.initiativeId,
    ]);
    expect(second.record.reconsiderationDate?.toISOString().slice(0, 10)).toBe(
      tomorrow,
    );
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
      marketSignals.decide({
        tenantId,
        actorId: "market-owner",
        signalId,
        evidenceRefs: [],
        prepared: prepareMarketSignalDecision(
          { ...signal, evidenceRefs: [] },
          {
            contractVersion: "market-signal-decision.v1",
            expectedSignalVersion: signal.version,
            decisionType: "dismiss",
            dismissReason: "不应在待接回期间改变去向",
            idempotencyKey: `dismiss-return-pending:${signalId}`,
          },
        ),
      }),
    ).rejects.toThrowError(/MARKET_SIGNAL_SELECTION_RETURN_PENDING/);

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

  it("接回后再次交接生成新版本且不改写旧机会包、立项和判断", async () => {
    const { tenantId, handoffId, signalId } = await seedOpportunity();
    await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId },
        {
          outcome: "return_to_market",
          returnReason: "补充新的目标市场证据",
          returnBasis: "insufficient_evidence",
        },
      ),
    });
    const pendingSignal = await marketSignals.findById(tenantId, signalId);
    await initiatives.takeBackSelectionReturn({
      tenantId,
      signalId,
      actorId: "market-owner",
      command: prepareSelectionReturnTakeback({
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: pendingSignal!.version,
        idempotencyKey: `takeback-for-rehandoff:${signalId}`,
      }),
    });

    const oldHandoff = await prisma.marketOpportunityHandoff.findFirstOrThrow({
      where: { id: handoffId, tenantId },
    });
    const oldInitiative = await prisma.productInitiative.findFirstOrThrow({
      where: { tenantId, handoffId },
    });
    const oldDecisions = await prisma.marketSignalDecision.findMany({
      where: { tenantId, signalId },
      orderBy: { decisionVersion: "asc" },
    });
    const returnedSignal = await marketSignals.findById(tenantId, signalId);
    const rehandoff = await marketSignals.decide({
      tenantId,
      actorId: "market-owner",
      signalId,
      evidenceRefs: [],
      prepared: prepareMarketSignalDecision(
        { ...returnedSignal!, evidenceRefs: [] },
        {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: returnedSignal!.version,
          decisionType: "handoff",
          opportunityStatement: "已补充目标市场证据，请重新评估。",
          idempotencyKey: `rehandoff:${signalId}`,
        },
      ),
    });

    expect(rehandoff.handoff).toMatchObject({
      version: 2,
      signalId,
      opportunityStatement: "已补充目标市场证据，请重新评估。",
    });
    expect(rehandoff.handoff!.handoffId).not.toBe(handoffId);
    const oldHandoffAfter =
      await prisma.marketOpportunityHandoff.findFirstOrThrow({
        where: { id: handoffId, tenantId },
      });
    expect(oldHandoffAfter).toEqual({ ...oldHandoff, isCurrent: false });
    await expect(
      prisma.productInitiative.findFirstOrThrow({
        where: { tenantId, handoffId },
      }),
    ).resolves.toEqual(oldInitiative);
    await expect(
      prisma.marketSignalDecision.findMany({
        where: { id: { in: oldDecisions.map(({ id }) => id) } },
        orderBy: { decisionVersion: "asc" },
      }),
    ).resolves.toEqual(oldDecisions);
  });

  it("跨租户不能接回选品退回请求且两侧状态保持不变", async () => {
    const { tenantId, handoffId, signalId } = await seedOpportunity();
    await initiatives.persistDecision({
      tenantId,
      handoffId,
      actorId: "selector-1",
      command: decide(
        { handoffId },
        {
          outcome: "return_to_market",
          returnReason: "需要市场补充证据",
          returnBasis: "insufficient_evidence",
        },
      ),
    });
    const pendingSignal = await marketSignals.findById(tenantId, signalId);

    await expect(
      initiatives.takeBackSelectionReturn({
        tenantId: randomUUID(),
        signalId,
        actorId: "other-market-owner",
        command: prepareSelectionReturnTakeback({
          contractVersion: "market-selection-return-takeback.v1",
          expectedSignalVersion: pendingSignal!.version,
          idempotencyKey: `cross-tenant-takeback:${signalId}`,
        }),
      }),
    ).rejects.toThrowError(/PRODUCT_INITIATIVE_NOT_FOUND/);
    await expect(
      prisma.marketSignal.findFirstOrThrow({
        where: { id: signalId, tenantId },
      }),
    ).resolves.toMatchObject({
      currentDestination: "selection_return_requested",
    });
    await expect(
      prisma.productInitiative.findFirstOrThrow({
        where: { tenantId, handoffId },
      }),
    ).resolves.toMatchObject({ currentDestination: "return_requested" });
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

async function seedOpportunity(
  accepted = true,
  tenantId: string = randomUUID(),
): Promise<{
  tenantId: string;
  handoffId: string;
  signalId: string;
}> {
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId,
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

async function seedSignalEvidence(
  tenantId: string,
  signalId: string,
): Promise<string> {
  const evidenceId = randomUUID();
  await prisma.evidenceRecord.create({
    data: {
      id: evidenceId,
      tenantId,
      idempotencyKey: `initiative-evidence:${evidenceId}`,
      evidenceType: "market_observation",
      subjectType: "market_signal",
      subjectId: signalId,
      authorityLevel: "observed",
      contentRef: `evidence://${evidenceId}`,
      contentHash: "e".repeat(64),
      source: {
        sourceId: evidenceId,
        sourceType: "integration_test",
        originatorSystem: "logix.test",
        authoritySystem: "logix.test",
        ingestionChannel: "manual",
        captureSource: "integration_test",
      },
      verificationState: "unverified",
      confidenceState: "unknown",
      validity: "effective",
      receivedAt: new Date(),
      recordedAt: new Date(),
    },
  });
  return evidenceId;
}

async function expectEvidenceRejected(
  opportunity: { tenantId: string; handoffId: string; signalId: string },
  evidenceId: string,
): Promise<void> {
  await expect(
    decideInitiatives.execute({
      tenantId: opportunity.tenantId,
      actorId: "selector-1",
      handoffId: opportunity.handoffId,
      command: completeApproveCommand(evidenceId),
    }),
  ).rejects.toMatchObject({
    status: 400,
    message: `PRODUCT_INITIATIVE_EVIDENCE_INVALID: ${evidenceId}`,
  });
  await expect(
    prisma.productInitiative.count({
      where: {
        tenantId: opportunity.tenantId,
        handoffId: opportunity.handoffId,
      },
    }),
  ).resolves.toBe(0);
  await expect(
    prisma.productInitiativeHandoff.count({
      where: { tenantId: opportunity.tenantId },
    }),
  ).resolves.toBe(0);
  await expect(
    prisma.outboxMessage.count({
      where: {
        tenantId: opportunity.tenantId,
        eventType: "product_initiative.handed_off",
      },
    }),
  ).resolves.toBe(0);
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
    undefined,
    undefined,
    { marketCode: "CA", channelCode: "amazon", currencyResolution: "active" },
  );
}

function completeApprove(current: { handoffId: string }) {
  return decide(current, {
    outcome: "approve",
    objective: "把折叠宠物出行包做成可发布版本",
    acceptResponsibility: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人，采购验证 1 人",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    reviewPoints: REVIEW_POINT_CODES.map((code, index) => ({
      code,
      evidenceRefs: [evidenceId(index)],
      conclusion: `${code} 的结论`,
    })),
    unitEconomicsDraft: completeUnitEconomicsDraft(),
  });
}

function completeApproveCommand(
  evidenceId: string,
): ProductInitiativeDecisionCommandV1 {
  const requestId = randomUUID();
  return {
    contractVersion: "product-initiative-decision.v1",
    requestId,
    outcome: "approve",
    expectedInitiativeVersion: 0,
    objective: "把折叠宠物出行包做成可发布版本",
    acceptResponsibility: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人，采购验证 1 人",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    reviewPoints: REVIEW_POINT_CODES.map((code) => ({
      code,
      evidenceRefs: [evidenceId],
      conclusion: `${code} 的结论`,
    })),
    unitEconomicsDraft: completeUnitEconomicsDraft(),
    idempotencyKey: `decision:${requestId}`,
  };
}

function completeUnitEconomicsDraft(evidenceRef?: string) {
  const cost = {
    min: "1",
    max: "2",
    basis: evidenceRef ? ("evidence" as const) : ("assumption" as const),
    evidenceRefs: evidenceRef ? [evidenceRef] : [],
  };
  const scenario = {
    salePrice: { ...cost, min: "20", max: "30" },
    landedCost: cost,
    platformFee: cost,
    fulfillmentFee: cost,
    advertisingCost: cost,
    returnCost: cost,
  };
  return {
    channelCode: "amazon",
    currencyCode: "USD",
    scenarios: { baseline: scenario, conservative: scenario },
  };
}

function negativeConservativeUnitEconomicsDraft() {
  const draft = completeUnitEconomicsDraft();
  return {
    ...draft,
    scenarios: {
      ...draft.scenarios,
      conservative: {
        ...draft.scenarios.conservative,
        salePrice: {
          ...draft.scenarios.conservative.salePrice,
          min: "5",
        },
      },
    },
  };
}

async function seedActiveCurrency(): Promise<void> {
  const releaseId = randomUUID();
  await prisma.referenceDataRelease.create({
    data: {
      id: releaseId,
      authority: "SIX",
      datasetCode: "ISO_4217_LIST_ONE",
      version: "2026-09-17-integration",
      publishedAt: new Date("2026-09-17T00:00:00.000Z"),
      sourceUrl:
        "https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml",
      retrievedAt: new Date("2026-10-04T00:00:00.000Z"),
      sourceSha256: "a".repeat(64),
      recordsSha256: "b".repeat(64),
      license: "integration test fixture",
      status: "active",
      currencyCodes: {
        create: {
          id: randomUUID(),
          alphaCode: "USD",
          numericCode: "840",
          minorUnit: 2,
          currencyName: "US Dollar",
          sourceRowHash: "c".repeat(64),
        },
      },
    },
  });
}

async function seedInactiveCurrency(): Promise<void> {
  const existing = await prisma.currencyCodeReference.findFirst({
    where: { alphaCode: "EUR" },
  });
  if (existing) return;
  const releaseId = randomUUID();
  await prisma.referenceDataRelease.create({
    data: {
      id: releaseId,
      authority: "SIX",
      datasetCode: "ISO_4217_LIST_ONE",
      version: `2026-09-16-inactive-${releaseId}`,
      publishedAt: new Date("2026-09-16T00:00:00.000Z"),
      sourceUrl:
        "https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml",
      retrievedAt: new Date("2026-10-04T00:00:00.000Z"),
      sourceSha256: "d".repeat(64),
      recordsSha256: "e".repeat(64),
      license: "integration test fixture",
      status: "superseded",
      currencyCodes: {
        create: {
          id: randomUUID(),
          alphaCode: "EUR",
          numericCode: "978",
          minorUnit: 2,
          currencyName: "Euro",
          sourceRowHash: "f".repeat(64),
        },
      },
    },
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

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
