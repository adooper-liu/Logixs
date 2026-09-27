// 产品与 SKU 身份在**真实 PostgreSQL** 上的验证。
//
// 单元测试替不掉的三件事：SKU 编号撞号（既有约束是**租户级唯一**，跨产品也不行）、
// 并发建档只成一个人、跨租户看不到。还有一件只在这里立得住：**发布的不可变交接快照**。
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
import { PrismaProductDefinitionRepository } from "../../modules/product-selection/infrastructure/prisma-product-definition.repository";
import { PrismaProductInitiativeRepository } from "../../modules/product-selection/infrastructure/prisma-product-initiative.repository";
import {
  prepareProductIdentityDraft,
  prepareSellableSkuRelease,
} from "../../modules/master-data/domain/product-identity";
import { DraftProductIdentityService } from "../../modules/master-data/application/draft-product-identity.service";
import { PrismaProductIdentityRepository } from "../../modules/master-data/infrastructure/prisma-product-identity.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_product_identity_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
const OWNER = "product-owner";
const REVIEW_POINT_CODES = [
  "target_user_and_market",
  "competitive_supply",
  "price_band_and_margin",
  "compliance_risk",
] as const;

let prisma: PrismaClient;
let identities: PrismaProductIdentityRepository;
let definitions: PrismaProductDefinitionRepository;
let initiatives: PrismaProductInitiativeRepository;
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
  identities = new PrismaProductIdentityRepository(prisma as never);
  definitions = new PrismaProductDefinitionRepository(prisma as never);
  initiatives = new PrismaProductInitiativeRepository(prisma as never);
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

describe("建档队列", () => {
  it("已发布的产品设计出现在待建档队列里，未建档时没有产品号", async () => {
    const releaseId = await seedRelease();

    const queue = await identities.listQueue({ tenantId, take: 50 });

    const row = queue.find((entry) => entry.releaseId === releaseId);
    expect(row?.productId).toBeNull();
    expect(row?.specification).toBe("已冻结的规格");
  });

  it("建档后队列里那一条带上产品号", async () => {
    const releaseId = await seedRelease();
    await draft(releaseId, {});

    const row = (await identities.listQueue({ tenantId, take: 50 })).find(
      (entry) => entry.releaseId === releaseId,
    );

    expect(row?.productId).not.toBeNull();
    expect(row?.productNumber).toMatch(/^P-[0-9A-F]{8}$/);
  });

  it("别的租户一条都看不到", async () => {
    const theirs = await seedRelease(randomUUID());

    const queue = await identities.listQueue({ tenantId, take: 200 });

    expect(queue.map((entry) => entry.releaseId)).not.toContain(theirs);
  });
});

describe("建档", () => {
  it("建立产品与 SKU；再存一次是同一行版本递增，SKU 认同一行", async () => {
    const releaseId = await seedRelease();
    const first = await draft(releaseId, {});
    const skuId = first.record.skus[0]!.skuId;

    // 带上已有 skuId 才是"改这一行"；不带就成了另一个 SKU，老的那条会被解除归属。
    const second = await persist(releaseId, {
      contractVersion: "product-identity-draft.v1",
      expectedVersion: 1,
      attributes: attributes({ hsCode: "8716800000" }),
      skus: [
        { skuId, skuCode: "SKU-1", attributes: skuAttributes() },
        { skuCode: "SKU-2", attributes: skuAttributes() },
      ],
      idempotencyKey: `draft-${randomUUID()}`,
    });

    expect(second.record.version).toBe(2);
    expect(second.record.skus.map((sku) => sku.skuId)).toContain(skuId);
    expect(
      await prisma.product.count({ where: { sourceHandoffId: releaseId } }),
    ).toBe(1);
  });

  it("命令里不再列出的 SKU 解除归属，但不删除 —— 下游可能在引用", async () => {
    const releaseId = await seedRelease();
    const first = await draft(releaseId, {});
    const droppedSkuId = first.record.skus[0]!.skuId;

    await draft(releaseId, {
      expectedDefinitionVersion: 1,
      skuCode: "SKU-NEW",
    });

    const detached = await prisma.productSku.findUniqueOrThrow({
      where: { id: droppedSkuId },
    });
    expect(detached.productId).toBeNull();
  });

  it("SKU 编号撞号时给明确冲突 —— 编号是租户级唯一的，跨产品也不行", async () => {
    const first = await seedRelease();
    const second = await seedRelease();
    await draft(first, {});
    const taken = await prisma.productSku.findFirstOrThrow({
      where: { tenantId },
      select: { productNumber: true },
    });

    await expect(
      draft(second, { skuCode: taken.productNumber }),
    ).rejects.toThrow(/PRODUCT_IDENTITY_SKU_CODE_TAKEN/);
  });

  it("响应丢了再发一次同样的请求，返回原记录而不是报版本冲突", async () => {
    const releaseId = await seedRelease();
    // 重放是**服务层**语义：领域规则会先判版本，走不到仓储的重放分支 ——
    // 与 3 号节点那片是同一个道理，所以这里从服务入口走。
    const service = new DraftProductIdentityService(identities);
    const command: ProductIdentityDraftCommandV1 = {
      contractVersion: "product-identity-draft.v1",
      expectedVersion: 0,
      attributes: attributes({}),
      skus: [
        {
          skuCode: `SKU-REPLAY-${randomUUID().slice(0, 6)}`,
          attributes: skuAttributes(),
        },
      ],
      idempotencyKey: `replay-${randomUUID()}`,
    };
    const input = {
      tenantId,
      actorId: OWNER,
      releaseId,
      command,
    };

    const first = await service.execute(input);
    // 库里已有一版，期望版本 0 已过期 —— 先判重放才不会把成功报成冲突。
    const second = await service.execute(input);

    expect(second.productId).toBe(first.productId);
    expect(
      await prisma.product.count({ where: { sourceHandoffId: releaseId } }),
    ).toBe(1);
  });

  it("两个人拿同一期望版本同时建档，只能成一个人", async () => {
    const releaseId = await seedRelease();

    const results = await Promise.allSettled([
      draft(releaseId, { skuCode: `SKU-A-${randomUUID().slice(0, 6)}` }),
      draft(releaseId, { skuCode: `SKU-B-${randomUUID().slice(0, 6)}` }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("发布", () => {
  it("发布写下不可变交接快照，冻结此刻的身份与 SKU", async () => {
    const releaseId = await seedRelease();
    const drafted = await draft(releaseId, {
      attributes: attributes({
        categoryCode: "pet_travel",
        functionalName: "折叠宠物推车",
        countryOfOrigin: "CN",
        hsCode: "8716800000",
        targetCountries: ["US", "CA"],
      }),
    });

    const released = await release(releaseId, drafted.record.version);

    expect(released.record.version).toBe(drafted.record.version + 1);
    const snapshot = await prisma.productIdentityRelease.findFirstOrThrow({
      where: { productId: released.record.productId },
    });
    expect(snapshot).toMatchObject({
      productNumber: released.record.productNumber,
      releasedBy: OWNER,
      pendingFieldCodes: ["bom", "listing"],
    });
    expect(snapshot.skus).toHaveLength(1);
  });

  it("HS 编码没填时不许发布，并逐项说明差什么", async () => {
    const releaseId = await seedRelease();
    const drafted = await draft(releaseId, {
      attributes: attributes({ categoryCode: "pet_travel" }),
    });

    await expect(release(releaseId, drafted.record.version)).rejects.toThrow(
      /hsCode/,
    );
    expect(
      await prisma.productIdentityRelease.count({
        where: { productId: drafted.record.productId },
      }),
    ).toBe(0);
  });

  it("发布后仍可继续改再发一版 —— 每次发布是一份新的不可变快照", async () => {
    const releaseId = await seedRelease();
    const ready = {
      categoryCode: "pet_travel",
      functionalName: "折叠宠物推车",
      countryOfOrigin: "CN",
      hsCode: "8716800000",
      targetCountries: ["US"],
    };
    const drafted = await draft(releaseId, { attributes: attributes(ready) });
    const first = await release(releaseId, drafted.record.version);
    const again = await draft(releaseId, {
      expectedDefinitionVersion: first.record.version,
      attributes: attributes({ ...ready, hsCode: "8716800099" }),
    });
    await release(releaseId, again.record.version);

    const snapshots = await prisma.productIdentityRelease.findMany({
      where: { productId: first.record.productId },
      orderBy: { version: "asc" },
    });
    expect(snapshots).toHaveLength(2);
    // 旧快照保持原样，不被新版本覆盖。
    expect((snapshots[0]!.skus as { skuId: string }[]).length).toBeGreaterThan(
      0,
    );
  });
});

function attributes(
  overrides: Partial<ProductAttributesV1> = {},
): ProductAttributesV1 {
  return {
    categoryCode: null,
    brandName: null,
    subBrandName: null,
    modelNumber: null,
    functionalName: null,
    countryOfOrigin: null,
    hsCode: null,
    targetCountries: [],
    certifications: [],
    temperature: null,
    dangerousGoods: null,
    orderConditions: {
      leadTimeDays: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      orderSizingFactor: null,
      orderMultiple: null,
    },
    ...overrides,
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

async function draft(
  releaseId: string,
  overrides: {
    expectedDefinitionVersion?: number;
    skuCode?: string;
    attributes?: ProductAttributesV1;
    idempotencyKey?: string;
  },
) {
  return persist(releaseId, {
    contractVersion: "product-identity-draft.v1",
    expectedVersion: overrides.expectedDefinitionVersion ?? 0,
    attributes: overrides.attributes ?? attributes({}),
    skus: [
      {
        skuCode: overrides.skuCode ?? `SKU-${randomUUID().slice(0, 8)}`,
        attributes: skuAttributes(),
      },
    ],
    idempotencyKey: overrides.idempotencyKey ?? `draft-${randomUUID()}`,
  });
}

async function persist(
  releaseId: string,
  command: ProductIdentityDraftCommandV1,
) {
  const current = await identities.findBySourceHandoffId(tenantId, releaseId);
  return identities.persistDraft({
    tenantId,
    sourceHandoffId: releaseId,
    specification: "已冻结的规格",
    actorId: OWNER,
    command: prepareProductIdentityDraft(
      {
        version: current?.version ?? 0,
        productNumber: current?.productNumber ?? null,
        skuCount: current?.skus.length ?? 0,
        attributes: current?.attributes ?? null,
      },
      releaseId,
      command,
    ),
  });
}

async function release(releaseId: string, version: number) {
  const current = await identities.findBySourceHandoffId(tenantId, releaseId);
  return identities.persistRelease({
    tenantId,
    productId: current!.productId,
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
        expectedVersion: version,
        idempotencyKey: `release-${randomUUID()}`,
      },
    ),
  });
}

/** 走真实链路把一票推到「已发布」，拿到那份发布快照的 id。 */
async function seedRelease(owner = tenantId): Promise<string> {
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId: owner,
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
  const approved = await initiatives.persistDecision({
    tenantId: owner,
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
    where: { initiativeId: approved.record.initiativeId, tenantId: owner },
    orderBy: { version: "desc" },
  });
  await initiatives.appendClaim({
    tenantId: owner,
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

  // 推到 MP：三段结论各写一次并前进一段。
  let version = 0;
  for (const conclusion of ["功能样机通过", "设计冻结", "试产可行"]) {
    const result = await definitions.persistWrite({
      tenantId: owner,
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
    owner,
    handoff.id,
  );
  await definitions.persistRelease({
    tenantId: owner,
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
  const releaseRow = await prisma.productDefinitionRelease.findFirstOrThrow({
    where: { definitionId: definition!.definitionId, tenantId: owner },
    orderBy: { version: "desc" },
  });
  return releaseRow.id;
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
