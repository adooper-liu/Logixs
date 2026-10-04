// 供应商准入、报价与定点在**真实 PostgreSQL** 上的验证。
//
// 单元测试替不掉的三件事：名称租户内唯一由数据库拦、两人同时定点只成一人、
// 跨租户看不到。还有一件只在这里立得住：**定点快照冻结了供应商名称与国别** ——
// 主数据后来改名，不影响当时定的是什么。
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ProductAttributesV1,
  ProductDefinitionWriteCommandV1,
  ProductIdentityDraftCommandV1,
  ProductInitiativeDecisionCommandV1,
  ProductSkuAttributesV1,
  RecordQuotationCommandV1,
} from "@logix/contracts";
import { PrismaClient } from "../../../../../generated/prisma";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import {
  prepareProductDefinitionRelease,
  prepareProductDefinitionWrite,
} from "../../modules/product-selection/domain/product-definition";
import { prepareProductInitiativeClaim } from "../../modules/product-selection/domain/product-initiative-claim";
import { prepareProductInitiativeDecision } from "../../modules/product-selection/domain/product-initiative";
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
  ListSourcingQueueService,
  NominateSupplierService,
  RecordQuotationService,
  RegisterSupplierService,
} from "../../modules/sourcing/application/supplier-nomination.services";
import { PrismaSupplierNominationRepository } from "../../modules/sourcing/infrastructure/prisma-supplier-nomination.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_sourcing_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
const OWNER = "product-owner";
const BUYER = "sourcing-buyer";
const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
] as const;

let prisma: PrismaClient;
let repository: PrismaSupplierNominationRepository;
let queue: ListSourcingQueueService;
let register: RegisterSupplierService;
let admit: AdmitSupplierService;
let quote: RecordQuotationService;
let nominate: NominateSupplierService;
let identity: PrismaProductIdentityRepository;
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
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `MIGRATION_DEPLOY_FAILED\n${output.stdout?.toString() ?? ""}\n${
        output.stderr?.toString() ?? ""
      }`,
      { cause: error },
    );
  }
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();
  repository = new PrismaSupplierNominationRepository(prisma as never);
  queue = new ListSourcingQueueService(repository);
  register = new RegisterSupplierService(repository);
  admit = new AdmitSupplierService(repository);
  quote = new RecordQuotationService(repository);
  nominate = new NominateSupplierService(repository);
  identity = new PrismaProductIdentityRepository(prisma as never);
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

describe("待寻源队列", () => {
  it("4 号发布出来的 SKU 出现在队列里，还没人报价时没有候选", async () => {
    const seeded = await seedRelease();

    const page = await queue.execute({ tenantId });

    const entry = page.entries.find(
      (row) =>
        row.skuReleaseId === seeded.releaseId && row.skuId === seeded.skuId,
    );
    expect(entry).toBeDefined();
    expect(entry?.quotations).toHaveLength(0);
    expect(entry?.nominated).toBeNull();
  });

  it("别的租户看不到这份发布", async () => {
    const seeded = await seedRelease();

    const page = await queue.execute({ tenantId: randomUUID() });

    expect(page.entries.map((row) => row.skuReleaseId)).not.toContain(
      seeded.releaseId,
    );
  });
});

describe("供应商与报价", () => {
  it("名称租户内唯一 —— 重名是业务冲突，明确失败", async () => {
    await registerSupplier("宁波某某塑胶");

    await expect(registerSupplier("宁波某某塑胶")).rejects.toThrow(
      /SUPPLIER_NAME_TAKEN/,
    );
  });

  it("报价录入后该供应商成为这票的候选，十项与关键物料都在", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `供应商-${randomUUID().slice(0, 6)}`,
    );

    await quoteIt(seeded, supplierId, {
      keyMaterials: [
        {
          name: "改性 PP 粒子",
          specification: "牌号 K8003",
          quantityPerUnit: 0.42,
          quantityUnit: "kg",
          lossRatePercent: 3,
          suppliedByCustomer: false,
        },
      ],
    });

    const entry = await entryOf(seeded);
    expect(entry?.suppliers.map((row) => row.supplierId)).toContain(supplierId);
    expect(entry?.quotations[0]).toMatchObject({
      incoterms: "FOB Ningbo / Incoterms 2020",
      version: 1,
    });
    expect(entry?.quotations[0]?.keyMaterials).toHaveLength(1);
  });

  it("同一供应商再报一次是版本递增，不是第二条", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `供应商-${randomUUID().slice(0, 6)}`,
    );
    await quoteIt(seeded, supplierId, {});

    const second = await quoteIt(seeded, supplierId, {}, 1);

    expect(second.version).toBe(2);
    expect(
      await prisma.supplierQuotation.count({
        where: { skuReleaseId: seeded.releaseId, skuId: seeded.skuId },
      }),
    ).toBe(1);
  });

  it("响应丢了再发一次同样的报价，返回原记录而不是报冲突", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `供应商-${randomUUID().slice(0, 6)}`,
    );
    const command = quotationCommand(`replay-${randomUUID()}`);

    const first = await quote.execute({
      tenantId,
      actorId: BUYER,
      supplierId,
      skuReleaseId: seeded.releaseId,
      skuId: seeded.skuId,
      command,
    });
    // 库里已有一版，期望版本 0 已过期 —— 先判重放才不会把成功报成冲突。
    const second = await quote.execute({
      tenantId,
      actorId: BUYER,
      supplierId,
      skuReleaseId: seeded.releaseId,
      skuId: seeded.skuId,
      command,
    });

    expect(second.quotationId).toBe(first.quotationId);
    expect(second.version).toBe(1);
  });
});

describe("定点", () => {
  it("写下不可变交接快照，带齐五项；且不再出现在待定价的候选里", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `供应商-${randomUUID().slice(0, 6)}`,
    );
    const quotation = await quoteIt(seeded, supplierId, {});

    const nominated = await nominateIt(
      quotation.quotationId,
      quotation.version,
    );

    expect(nominated).toMatchObject({
      supplierId,
      sampleConclusion: "确认样与图纸一致，缝线加固已改",
      capacityConstraint: "月产能约 3 万件，旺季需提前 45 天排产",
      quotationVersion: 1,
    });
    const entry = await entryOf(seeded);
    expect(entry?.nominated?.handoffId).toBe(nominated.handoffId);
  });

  it("没准入的供应商不能定点 —— 没审过的对象不承担质量责任", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `供应商-${randomUUID().slice(0, 6)}`,
      { admit: false },
    );
    const quotation = await quoteIt(seeded, supplierId, {});

    await expect(
      nominateIt(quotation.quotationId, quotation.version),
    ).rejects.toThrow(/SUPPLIER_NOT_ADMITTED/);
  });

  it("两人同时定点，只写下一份快照", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `供应商-${randomUUID().slice(0, 6)}`,
    );
    const quotation = await quoteIt(seeded, supplierId, {});

    // 同一幂等键 = 同一个请求被发两次（重试）；不同键就是两次定点，
    // 那按设计本来就该追加两版。这里验的是前者。
    const key = `nominate-${randomUUID()}`;
    const results = await Promise.allSettled([
      nominateIt(quotation.quotationId, quotation.version, key),
      nominateIt(quotation.quotationId, quotation.version, key),
    ]);

    expect(
      await prisma.supplierNominationRelease.count({
        where: { skuReleaseId: seeded.releaseId, skuId: seeded.skuId },
      }),
    ).toBe(1);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  });

  it("快照冻结供应商名称 —— 主数据后来改名，不影响当时定的是什么", async () => {
    const seeded = await seedRelease();
    const supplierId = await registerSupplier(
      `原名-${randomUUID().slice(0, 6)}`,
    );
    const quotation = await quoteIt(seeded, supplierId, {});
    const nominated = await nominateIt(
      quotation.quotationId,
      quotation.version,
    );

    await prisma.supplier.update({
      where: { id: supplierId },
      data: { name: `改名后-${randomUUID().slice(0, 6)}` },
    });

    const snapshot = await prisma.supplierNominationRelease.findUniqueOrThrow({
      where: { id: nominated.handoffId },
    });
    expect(snapshot.supplierName).toBe(nominated.supplierName);
  });
});

async function entryOf(seeded: { releaseId: string; skuId: string }) {
  const page = await queue.execute({ tenantId });
  return page.entries.find(
    (row) =>
      row.skuReleaseId === seeded.releaseId && row.skuId === seeded.skuId,
  );
}

async function registerSupplier(
  name: string,
  options: { admit?: boolean } = {},
): Promise<string> {
  const supplier = await register.execute({
    tenantId,
    actorId: BUYER,
    command: {
      contractVersion: "supplier-register.v1",
      name,
      countryCode: "CN",
      admissionState: "pending",
      // 每次登记都是**另一个请求**，所以幂等键要唯一 ——
      // 用同一个键会被当成重放，撞不到名称唯一那条约束。
      idempotencyKey: `register-${randomUUID()}`,
    },
  });
  if (options.admit === false) {
    return supplier.supplierId;
  }
  const admitted = await admit.execute({
    tenantId,
    actorId: BUYER,
    supplierId: supplier.supplierId,
    command: {
      contractVersion: "supplier-admit.v1",
      expectedSupplierVersion: supplier.version,
      idempotencyKey: `admit-${randomUUID()}`,
    },
  });
  return admitted.supplierId;
}

function quotationCommand(
  idempotencyKey: string,
  expectedQuotationVersion = 0,
): RecordQuotationCommandV1 {
  return {
    contractVersion: "supplier-quotation-record.v1",
    expectedQuotationVersion,
    priceTiers: [
      { minQuantity: 1000, unitPrice: "18.5000", currency: "USD" },
      { minQuantity: 500, unitPrice: "19.2000", currency: "USD" },
    ],
    incoterms: "FOB Ningbo / Incoterms 2020",
    exclusions: "不含目的港费用",
    idempotencyKey,
  };
}

async function quoteIt(
  seeded: { releaseId: string; skuId: string },
  supplierId: string,
  overrides: Partial<RecordQuotationCommandV1>,
  expectedQuotationVersion = 0,
) {
  return quote.execute({
    tenantId,
    actorId: BUYER,
    supplierId,
    skuReleaseId: seeded.releaseId,
    skuId: seeded.skuId,
    command: {
      ...quotationCommand(`quote-${randomUUID()}`, expectedQuotationVersion),
      ...overrides,
    },
  });
}

async function nominateIt(
  quotationId: string,
  version: number,
  idempotencyKey = `nominate-${randomUUID()}`,
) {
  return nominate.execute({
    tenantId,
    actorId: BUYER,
    command: {
      contractVersion: "supplier-nominate.v1",
      quotationId,
      expectedQuotationVersion: version,
      sampleConclusion: "确认样与图纸一致，缝线加固已改",
      capacityConstraint: "月产能约 3 万件，旺季需提前 45 天排产",
      idempotencyKey,
    },
  });
}

/** 走真实链路把一票推到 4 号的「已发布」，拿到发布 id 与其中一个 SKU。 */
async function seedRelease(): Promise<{ releaseId: string; skuId: string }> {
  const marketSignals = new PrismaMarketSignalRepository(prisma as never);
  const initiatives = new PrismaProductInitiativeRepository(prisma as never);
  const productOpportunities = new PrismaProductOpportunityRepository(
    prisma as never,
  );
  const definitions = new PrismaProductDefinitionRepository(prisma as never);

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
  await acceptOpportunity(
    productOpportunities,
    tenantId,
    decided.handoff!.handoffId,
  );
  const approved = await initiatives.persistDecision({
    tenantId,
    handoffId: decided.handoff!.handoffId,
    actorId: "selector-1",
    command: prepareProductInitiativeDecision({ version: 0 }, "selector-1", {
      contractVersion: "product-initiative-decision.v1",
      requestId: randomUUID(),
      outcome: "approve",
      expectedInitiativeVersion: 0,
      objective: "验证宠物出行品类是否值得立项",
      reviewPoints: REVIEW_POINT_CODES.map((code) => ({
        code,
        evidenceRefs: [randomUUID()],
        conclusion: "已核实",
      })),
      idempotencyKey: `decision:${randomUUID()}`,
    } as ProductInitiativeDecisionCommandV1),
  });
  const handoff = await prisma.productInitiativeHandoff.findFirstOrThrow({
    where: { initiativeId: approved.record.initiativeId, tenantId },
    orderBy: { version: "desc" },
  });
  await initiatives.appendClaim({
    tenantId,
    handoffId: handoff.id,
    command: prepareProductInitiativeClaim(
      { claimVersion: 0, productOwnerActorId: null },
      OWNER,
      {
        contractVersion: "product-initiative-claim.v1",
        expectedClaimVersion: 0,
        idempotencyKey: `claim-${handoff.id}`,
      },
    ),
  });

  let version = 0;
  for (const conclusion of ["功能样机通过", "设计冻结", "试产可行"]) {
    const result = await definitions.persistWrite({
      tenantId,
      initiativeHandoffId: handoff.id,
      productOwnerActorId: OWNER,
      actorId: OWNER,
      command: prepareProductDefinitionWrite(
        {
          version,
          npiStage: version === 0 ? "evt" : version === 1 ? "dvt" : "pvt",
          specification: null,
          complianceAssumptions: [],
          concludedStages: [],
        },
        OWNER,
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
    handoff.id,
  );
  await definitions.persistRelease({
    tenantId,
    definitionId: definition!.definitionId,
    actorId: OWNER,
    command: prepareProductDefinitionRelease(
      {
        version: definition!.version,
        npiStage: "mp",
        specification: "已冻结的规格",
        complianceAssumptions: ["CE"],
        concludedStages: ["evt", "dvt", "pvt"],
      },
      OWNER,
      {
        contractVersion: "product-definition-release.v1",
        expectedDefinitionVersion: definition!.version,
        decision: "release",
        idempotencyKey: `release-${randomUUID()}`,
      },
    ),
  });
  const release = await prisma.productDefinitionRelease.findFirstOrThrow({
    where: { definitionId: definition!.definitionId, tenantId },
    orderBy: { version: "desc" },
  });

  // 4 号建档并发布可售 SKU，交出这一片的入向。
  const drafted = await identity.persistDraft({
    tenantId,
    sourceHandoffId: release.id,
    specification: release.specification,
    actorId: OWNER,
    command: prepareProductIdentityDraft(
      { version: 0, productNumber: null, skuCount: 0, attributes: null },
      release.id,
      {
        contractVersion: "product-identity-draft.v1",
        expectedVersion: 0,
        attributes: attributes(),
        skus: [
          {
            skuCode: `SKU-${randomUUID().slice(0, 8)}`,
            attributes: skuAttributes(),
          },
        ],
        idempotencyKey: `draft-${randomUUID()}`,
      } as ProductIdentityDraftCommandV1,
    ),
  });
  const current = await identity.findBySourceHandoffId(tenantId, release.id);
  await identity.persistRelease({
    tenantId,
    productId: drafted.record.productId,
    actorId: OWNER,
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
        idempotencyKey: `release-${randomUUID()}`,
      },
    ),
  });
  const identityRelease = await prisma.productIdentityRelease.findFirstOrThrow({
    where: { productId: drafted.record.productId, tenantId },
    orderBy: { version: "desc" },
  });
  const skus = identityRelease.skus as { skuId: string }[];
  return { releaseId: identityRelease.id, skuId: skus[0]!.skuId };
}

async function acceptOpportunity(
  repository: PrismaProductOpportunityRepository,
  owner: string,
  handoffId: string,
): Promise<void> {
  const actorId = "selector-1";
  await repository.appendIntake({
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
  await repository.appendIntake({
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

function attributes(): ProductAttributesV1 {
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
