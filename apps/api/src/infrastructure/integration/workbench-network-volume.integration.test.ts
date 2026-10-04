import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type {
  MarketSignalDecisionCommandV1,
  ProductAttributesV1,
  ProductDefinitionWriteCommandV1,
  ProductIdentityDraftCommandV1,
  ProductInitiativeDecisionCommandV1,
  ProductSkuAttributesV1,
  RecordQuotationCommandV1,
} from "@logix/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { ApplySelectionReturnService } from "../../modules/market-intelligence/application/apply-selection-return.service";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import {
  prepareProductInitiativeDecision,
  prepareSelectionReturnTakeback,
} from "../../modules/product-selection/domain/product-initiative";
import {
  prepareProductDefinitionRelease,
  prepareProductDefinitionWrite,
} from "../../modules/product-selection/domain/product-definition";
import { prepareProductInitiativeClaim } from "../../modules/product-selection/domain/product-initiative-claim";
import { prepareOpportunityIntake } from "../../modules/product-selection/domain/product-opportunity";
import { PrismaProductDefinitionRepository } from "../../modules/product-selection/infrastructure/prisma-product-definition.repository";
import { PrismaProductInitiativeRepository } from "../../modules/product-selection/infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";
import {
  prepareProductIdentityDraft,
  prepareSellableSkuRelease,
} from "../../modules/master-data/domain/product-identity";
import { PrismaProductIdentityRepository } from "../../modules/master-data/infrastructure/prisma-product-identity.repository";
import {
  AdmitSupplierService,
  NominateSupplierService,
  RecordQuotationService,
  RegisterSupplierService,
} from "../../modules/sourcing/application/supplier-nomination.services";
import { PrismaSupplierNominationRepository } from "../../modules/sourcing/infrastructure/prisma-supplier-nomination.repository";
import { PrismaWorkbenchNetworkVolumeRepository } from "../../modules/workbench-network/infrastructure/prisma-workbench-network-volume.repository";
import { WorkbenchNetworkModule } from "../../modules/workbench-network/workbench-network.module";
import { utcWeekStart } from "../../modules/workbench-network/domain/workbench-network-volume";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_hub_volume_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
const NOW = new Date("2026-10-04T12:00:00.000Z");
const THIS_WEEK = new Date("2026-10-01T08:00:00.000Z");
const LAST_WEEK = new Date("2026-09-21T08:00:00.000Z");

let prisma: PrismaClient;
let marketSignals: PrismaMarketSignalRepository;
let initiatives: PrismaProductInitiativeRepository;
let volume: PrismaWorkbenchNetworkVolumeRepository;

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
  initiatives = new PrismaProductInitiativeRepository(
    prisma as never,
    new ApplySelectionReturnService(marketSignals),
  );
  volume = new PrismaWorkbenchNetworkVolumeRepository(prisma as never);
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

describe("workbench network volume counts", () => {
  it("counts only the responsibility still held, and keeps other tenants at zero", async () => {
    const tenantId = randomUUID();
    await createSignal(tenantId);
    await decideSignal(tenantId, {
      decisionType: "watch",
      nextReviewDate: "2026-10-20",
      watchFocus: "确认趋势是否持续",
    });
    await decideSignal(tenantId, {
      decisionType: "dismiss",
      dismissReason: "不是本季经营范围",
    });
    await decideSignal(tenantId, {
      decisionType: "void",
      judgmentNote: "重复登记，作废本条",
    });
    await decideSignal(tenantId, {
      decisionType: "archive",
      judgmentNote: "窗口已过，归档",
    });
    await handoff(tenantId, "queued");
    await handoff(tenantId, "claimed");
    await accept(tenantId, THIS_WEEK);
    const pendingReturn = await accept(tenantId, THIS_WEEK);
    await initiatives.persistDecision({
      tenantId,
      handoffId: pendingReturn.handoffId,
      actorId: "selector-1",
      command: initiativeDecision({
        outcome: "return_to_market",
        returnReason: "补充目标市场证据",
        returnBasis: "insufficient_evidence",
      }),
    });
    const takenBack = await accept(tenantId, THIS_WEEK);
    await initiatives.persistDecision({
      tenantId,
      handoffId: takenBack.handoffId,
      actorId: "selector-1",
      command: initiativeDecision({
        outcome: "return_to_market",
        returnReason: "方向需要市场重定",
        returnBasis: "wrong_direction",
      }),
    });
    const pendingSignal = await marketSignals.findById(
      tenantId,
      takenBack.signalId,
    );
    await initiatives.takeBackSelectionReturn({
      tenantId,
      signalId: takenBack.signalId,
      actorId: "market-owner",
      command: prepareSelectionReturnTakeback({
        contractVersion: "market-selection-return-takeback.v1",
        expectedSignalVersion: pendingSignal!.version,
        idempotencyKey: `takeback:${takenBack.signalId}`,
      }),
    });
    const approved = await accept(tenantId, THIS_WEEK);
    await initiatives.persistDecision({
      tenantId,
      handoffId: approved.handoffId,
      actorId: "selector-1",
      command: initiativeDecision({
        outcome: "approve",
        objective: "做成可发布版本",
        reviewPoints: reviewPoints(1),
      }),
    });
    const rejected = await accept(tenantId, LAST_WEEK);
    await initiatives.persistDecision({
      tenantId,
      handoffId: rejected.handoffId,
      actorId: "selector-1",
      command: initiativeDecision({
        outcome: "reject",
        rejectReason: "利润空间不够",
      }),
    });
    const deferred = await accept(tenantId, THIS_WEEK);
    await initiatives.persistDecision({
      tenantId,
      handoffId: deferred.handoffId,
      actorId: "selector-1",
      command: initiativeDecision({
        outcome: "defer",
        deferReason: "等竞争供给再看",
      }),
    });

    const weekStart = utcWeekStart(NOW);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const counts = await volume.count(tenantId, weekStart, weekEnd);
    expect(counts).toEqual({
      marketOpen: 5,
      marketPendingAcceptance: 2,
      marketWeeklyAccepts: 5,
      selectionOpen: 3,
      sourcingOpen: 0,
      sourcingPendingAcceptance: 0,
    });

    const other = await volume.count(randomUUID(), weekStart, weekEnd);
    expect(other).toEqual({
      marketOpen: 0,
      marketPendingAcceptance: 0,
      marketWeeklyAccepts: 0,
      selectionOpen: 0,
      sourcingOpen: 0,
      sourcingPendingAcceptance: 0,
    });
  });

  it("counts a quoted SKU as still open after nomination and ignores an unquoted SKU", async () => {
    const tenantId = randomUUID();
    const releases = await seedSellableSkus(tenantId);
    const sourcing = new PrismaSupplierNominationRepository(prisma as never);
    const register = new RegisterSupplierService(sourcing);
    const admit = new AdmitSupplierService(sourcing);
    const quote = new RecordQuotationService(sourcing);
    const nominate = new NominateSupplierService(sourcing);
    const supplier = await register.execute({
      tenantId,
      actorId: "sourcing-buyer",
      command: {
        contractVersion: "supplier-register.v1",
        name: `供应商-${randomUUID().slice(0, 8)}`,
        countryCode: "CN",
        admissionState: "pending",
        idempotencyKey: `register-${randomUUID()}`,
      },
    });
    const admitted = await admit.execute({
      tenantId,
      actorId: "sourcing-buyer",
      supplierId: supplier.supplierId,
      command: {
        contractVersion: "supplier-admit.v1",
        expectedSupplierVersion: supplier.version,
        idempotencyKey: `admit-${randomUUID()}`,
      },
    });
    const quoted = await quote.execute({
      tenantId,
      actorId: "sourcing-buyer",
      supplierId: admitted.supplierId,
      skuReleaseId: releases[0]!.releaseId,
      skuId: releases[0]!.skuId,
      command: quotationCommand(),
    });

    const weekStart = utcWeekStart(NOW);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const beforeNomination = await volume.count(tenantId, weekStart, weekEnd);
    expect(beforeNomination.sourcingOpen).toBe(1);
    expect(beforeNomination.sourcingPendingAcceptance).toBe(0);

    await nominate.execute({
      tenantId,
      actorId: "sourcing-buyer",
      command: {
        contractVersion: "supplier-nominate.v1",
        quotationId: quoted.quotationId,
        expectedQuotationVersion: quoted.version,
        sampleConclusion: "确认样与图纸一致",
        capacityConstraint: "月产能约 3 万件",
        idempotencyKey: `nominate-${randomUUID()}`,
      },
    });
    const afterNomination = await volume.count(tenantId, weekStart, weekEnd);
    expect(afterNomination.sourcingOpen).toBe(1);
    expect(afterNomination.sourcingPendingAcceptance).toBe(1);
  });

  it("counts each quoted and nominated SKU within the same release", async () => {
    const tenantId = randomUUID();
    const release = await seedOneRelease(tenantId, 2);
    const sourcing = new PrismaSupplierNominationRepository(prisma as never);
    const register = new RegisterSupplierService(sourcing);
    const admit = new AdmitSupplierService(sourcing);
    const quote = new RecordQuotationService(sourcing);
    const nominate = new NominateSupplierService(sourcing);
    const quotations = [];

    for (const [index, skuId] of release.skuIds.entries()) {
      const supplier = await register.execute({
        tenantId,
        actorId: "sourcing-buyer",
        command: {
          contractVersion: "supplier-register.v1",
          name: `双 SKU 供应商-${index}-${randomUUID().slice(0, 8)}`,
          countryCode: "CN",
          admissionState: "pending",
          idempotencyKey: `register-multi-${randomUUID()}`,
        },
      });
      const admitted = await admit.execute({
        tenantId,
        actorId: "sourcing-buyer",
        supplierId: supplier.supplierId,
        command: {
          contractVersion: "supplier-admit.v1",
          expectedSupplierVersion: supplier.version,
          idempotencyKey: `admit-multi-${randomUUID()}`,
        },
      });
      quotations.push(
        await quote.execute({
          tenantId,
          actorId: "sourcing-buyer",
          supplierId: admitted.supplierId,
          skuReleaseId: release.releaseId,
          skuId,
          command: quotationCommand(),
        }),
      );
    }

    const weekStart = utcWeekStart(NOW);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    expect(
      (await volume.count(tenantId, weekStart, weekEnd)).sourcingOpen,
    ).toBe(2);

    for (const quotation of quotations) {
      await nominate.execute({
        tenantId,
        actorId: "sourcing-buyer",
        command: {
          contractVersion: "supplier-nominate.v1",
          quotationId: quotation.quotationId,
          expectedQuotationVersion: quotation.version,
          sampleConclusion: "确认样与图纸一致",
          capacityConstraint: "月产能约 3 万件",
          idempotencyKey: `nominate-multi-${randomUUID()}`,
        },
      });
    }
    expect(
      (await volume.count(tenantId, weekStart, weekEnd))
        .sourcingPendingAcceptance,
    ).toBe(2);
  });
});

describe("workbench network volume endpoint", () => {
  let app: INestApplication | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkbenchNetworkModule],
    })
      .overrideProvider(PrismaWorkbenchNetworkVolumeRepository)
      .useValue({
        count: async () => ({
          marketOpen: 1,
          marketPendingAcceptance: 0,
          marketWeeklyAccepts: 0,
          selectionOpen: 0,
          sourcingOpen: 0,
          sourcingPendingAcceptance: 0,
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("refuses a role without planning.read", async () => {
    const response = await fetch(`${baseUrl}/workbench-network/volume`, {
      headers: {
        "x-tenant-id": "tenant-1",
        "x-operator-id": "operator-1",
        "x-roles": "field_operator",
      },
    });
    expect(response.status).toBe(403);
  });

  it("returns the projection for a role that can read planning", async () => {
    const response = await fetch(`${baseUrl}/workbench-network/volume`, {
      headers: {
        "x-tenant-id": "tenant-1",
        "x-operator-id": "operator-1",
        "x-roles": "operations_dispatcher",
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contractVersion: "workbench-network-volume.v1",
      currentPhase: null,
      global: { open: { state: "count", count: 1 } },
    });
  });
});

async function createSignal(tenantId: string): Promise<{ signalId: string }> {
  const signalId = randomUUID();
  await marketSignals.create({
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
  return { signalId };
}

async function decideSignal(
  tenantId: string,
  command: Partial<MarketSignalDecisionCommandV1> &
    Pick<MarketSignalDecisionCommandV1, "decisionType">,
): Promise<void> {
  const { signalId } = await createSignal(tenantId);
  const current = await marketSignals.findById(tenantId, signalId);
  await marketSignals.decide({
    tenantId,
    actorId: "market-owner",
    signalId,
    evidenceRefs: [],
    prepared: prepareMarketSignalDecision({ ...current!, evidenceRefs: [] }, {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: current!.version,
      idempotencyKey: `${command.decisionType}:${signalId}`,
      ...command,
    } as MarketSignalDecisionCommandV1),
  });
}

async function handoff(
  tenantId: string,
  state: "queued" | "claimed",
): Promise<{ handoffId: string; signalId: string }> {
  const { signalId } = await createSignal(tenantId);
  const current = await marketSignals.findById(tenantId, signalId);
  const decided = await marketSignals.decide({
    tenantId,
    actorId: "market-owner",
    signalId,
    evidenceRefs: [],
    prepared: prepareMarketSignalDecision(
      { ...current!, evidenceRefs: [] },
      {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: current!.version,
        decisionType: "handoff",
        opportunityStatement: "验证宠物出行机会是否值得立项。",
        idempotencyKey: `handoff:${signalId}`,
      },
    ),
  });
  const handoffId = decided.handoff!.handoffId;
  // queued 没有 intake 行：表约束只允许 claimed / accepted / superseded。
  if (state === "claimed") {
    await prisma.productOpportunityIntake.create({
      data: {
        id: randomUUID(),
        tenantId,
        handoffId,
        version: 1,
        state: "claimed",
        assignedActorId: "selector-1",
        actedBy: "selector-1",
        actedAt: THIS_WEEK,
        idempotencyKey: `claimed:${signalId}`,
        payloadHash: "a".repeat(64),
      },
    });
  }
  return { handoffId, signalId };
}

async function accept(
  tenantId: string,
  actedAt: Date,
): Promise<{ handoffId: string; signalId: string }> {
  const opened = await handoff(tenantId, "claimed");
  await prisma.productOpportunityIntake.updateMany({
    where: { tenantId, handoffId: opened.handoffId },
    data: { state: "accepted", actedAt, assignedActorId: "selector-1" },
  });
  return opened;
}

function reviewPoints(
  start: number,
): ProductInitiativeDecisionCommandV1["reviewPoints"] {
  return (
    [
      "target_user_and_market",
      "competitive_supply",
      "price_band_and_margin",
      "compliance_risk",
    ] as const
  ).map((code, index) => ({
    code,
    evidenceRefs: [
      `00000000-0000-4000-8000-${String(start + index).padStart(12, "0")}`,
    ],
    conclusion: `${code} 已核实`,
  }));
}

function initiativeDecision(
  overrides: Partial<ProductInitiativeDecisionCommandV1>,
) {
  const requestId = randomUUID();
  return prepareProductInitiativeDecision({ version: 0 }, "selector-1", {
    contractVersion: "product-initiative-decision.v1",
    requestId,
    outcome: "defer",
    expectedInitiativeVersion: 0,
    reviewPoints: [],
    idempotencyKey: `decision:${requestId}`,
    ...overrides,
  } as ProductInitiativeDecisionCommandV1);
}

async function seedSellableSkus(
  tenantId: string,
): Promise<Array<{ releaseId: string; skuId: string }>> {
  return [await seedOneRelease(tenantId), await seedOneRelease(tenantId)];
}

async function seedOneRelease(
  tenantId: string,
  skuCount = 1,
): Promise<{ releaseId: string; skuId: string; skuIds: string[] }> {
  const opportunities = new PrismaProductOpportunityRepository(prisma as never);
  const definitions = new PrismaProductDefinitionRepository(prisma as never);
  const identity = new PrismaProductIdentityRepository(prisma as never);
  const opened = await handoff(tenantId, "claimed");
  await opportunities.appendIntake({
    tenantId,
    handoffId: opened.handoffId,
    actorId: "selector-1",
    command: prepareOpportunityIntake(
      { version: 1, state: "claimed", assignedActorId: "selector-1" },
      "selector-1",
      {
        contractVersion: "product-opportunity-intake.v1",
        action: "accept",
        expectedIntakeVersion: 1,
        idempotencyKey: `accept-release:${opened.handoffId}`,
      },
    ),
  });
  const approved = await initiatives.persistDecision({
    tenantId,
    handoffId: opened.handoffId,
    actorId: "selector-1",
    command: initiativeDecision({
      outcome: "approve",
      objective: "做成可发布版本",
      reviewPoints: reviewPoints(11),
    }),
  });
  const initiativeHandoff =
    await prisma.productInitiativeHandoff.findFirstOrThrow({
      where: { initiativeId: approved.record.initiativeId, tenantId },
      orderBy: { version: "desc" },
    });
  await initiatives.appendClaim({
    tenantId,
    handoffId: initiativeHandoff.id,
    command: prepareProductInitiativeClaim(
      { claimVersion: 0, productOwnerActorId: null },
      "product-owner",
      {
        contractVersion: "product-initiative-claim.v1",
        expectedClaimVersion: 0,
        idempotencyKey: `claim-${initiativeHandoff.id}`,
      },
    ),
  });
  let version = 0;
  for (const conclusion of ["功能样机通过", "设计冻结", "试产可行"]) {
    const result = await definitions.persistWrite({
      tenantId,
      initiativeHandoffId: initiativeHandoff.id,
      productOwnerActorId: "product-owner",
      actorId: "product-owner",
      command: prepareProductDefinitionWrite(
        {
          version,
          npiStage: version === 0 ? "evt" : version === 1 ? "dvt" : "pvt",
          specification: null,
          complianceAssumptions: [],
          concludedStages: [],
        },
        "product-owner",
        {
          contractVersion: "product-definition-write.v1",
          expectedDefinitionVersion: version,
          specification: "已冻结的规格",
          complianceAssumptions: ["CE"],
          conclusion: { text: conclusion, evidenceRefs: [] },
          advanceStage: true,
          idempotencyKey: `write-${randomUUID()}`,
        } as ProductDefinitionWriteCommandV1,
      ),
    });
    version = result.record.version;
  }
  const definition = await definitions.findByInitiativeHandoffId(
    tenantId,
    initiativeHandoff.id,
  );
  await definitions.persistRelease({
    tenantId,
    definitionId: definition!.definitionId,
    actorId: "product-owner",
    command: prepareProductDefinitionRelease(
      {
        version: definition!.version,
        npiStage: "mp",
        specification: "已冻结的规格",
        complianceAssumptions: ["CE"],
        concludedStages: ["evt", "dvt", "pvt"],
      },
      "product-owner",
      {
        contractVersion: "product-definition-release.v1",
        expectedDefinitionVersion: definition!.version,
        decision: "release",
        idempotencyKey: `release-${randomUUID()}`,
      },
    ),
  });
  const definitionRelease =
    await prisma.productDefinitionRelease.findFirstOrThrow({
      where: { definitionId: definition!.definitionId, tenantId },
      orderBy: { version: "desc" },
    });
  const drafted = await identity.persistDraft({
    tenantId,
    sourceHandoffId: definitionRelease.id,
    specification: definitionRelease.specification,
    actorId: "product-owner",
    command: prepareProductIdentityDraft(
      { version: 0, productNumber: null, skuCount: 0, attributes: null },
      definitionRelease.id,
      {
        contractVersion: "product-identity-draft.v1",
        expectedVersion: 0,
        attributes: productAttributes(),
        skus: Array.from({ length: skuCount }, () => ({
          skuCode: `SKU-${randomUUID().slice(0, 8)}`,
          attributes: skuAttributes(),
        })),
        idempotencyKey: `draft-${randomUUID()}`,
      } as ProductIdentityDraftCommandV1,
    ),
  });
  const current = await identity.findBySourceHandoffId(
    tenantId,
    definitionRelease.id,
  );
  await identity.persistRelease({
    tenantId,
    productId: drafted.record.productId,
    actorId: "product-owner",
    command: prepareSellableSkuRelease(
      {
        version: current!.version,
        productNumber: current!.productNumber,
        skuCount: current!.skus.length,
        attributes: current!.attributes,
      },
      {
        contractVersion: "sellable-sku-release.v1",
        expectedVersion: current!.version,
        idempotencyKey: `sku-release-${randomUUID()}`,
      },
    ),
  });
  const identityRelease = await prisma.productIdentityRelease.findFirstOrThrow({
    where: { productId: drafted.record.productId, tenantId },
    orderBy: { version: "desc" },
  });
  const skus = identityRelease.skus as { skuId: string }[];
  return {
    releaseId: identityRelease.id,
    skuId: skus[0]!.skuId,
    skuIds: skus.map(({ skuId }) => skuId),
  };
}

function quotationCommand(): RecordQuotationCommandV1 {
  return {
    contractVersion: "supplier-quotation-record.v1",
    expectedQuotationVersion: 0,
    priceTiers: [{ minQuantity: 1000, unitPrice: "18.5000", currency: "USD" }],
    incoterms: "FOB Ningbo / Incoterms 2020",
    exclusions: "不含目的港费用",
    idempotencyKey: `quote-${randomUUID()}`,
  };
}

function productAttributes(): ProductAttributesV1 {
  return {
    categoryCode: "pet_travel",
    brandName: null,
    subBrandName: null,
    modelNumber: null,
    functionalName: "折叠宠物推车",
    countryOfOrigin: "CN",
    hsCode: "8716800000",
    targetCountries: ["US", "CA"],
    certifications: ["CE"],
    temperature: null,
    dangerousGoods: null,
    orderConditions: {
      leadTimeDays: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      orderSizingFactor: null,
      orderMultiple: null,
    },
  };
}

function skuAttributes(): ProductSkuAttributesV1 {
  return {
    colorCode: null,
    sizeDescription: null,
    netContent: null,
    grossWeight: null,
    dimensions: null,
    packaging: {
      itemsPerLayer: null,
      completedLayers: null,
      itemsPerConsumerUnit: null,
      consumerUnitsPerInnerPack: null,
    },
    stackingFactor: null,
    maxStackingWeight: null,
    barcode: null,
    battery: null,
  };
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
