// 产品定义与 NPI 发布在**真实 PostgreSQL** 上的验证。
//
// 单元测试里的替身替不掉三件事：并发推进只能成一个人、幂等键重复提交不写第二条、
// 跨租户一条都看不到。还有一件只在这里才立得住：**发布写的不可变交接快照**是
// 同一事务内的追加，主数据侧据此建档。
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ProductDefinitionWriteCommandV1,
  ProductInitiativeDecisionCommandV1,
} from "@logix/contracts";
import { PrismaClient } from "../../../../../generated/prisma";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import {
  completeUnitEconomicsDraft,
  PRODUCT_INITIATIVE_TEST_APPROVE_PREREQUISITE,
  PRODUCT_INITIATIVE_TEST_CONTEXT,
} from "./product-initiative-test-fixtures";
import { AdvanceProductDefinitionService } from "../../modules/product-selection/application/advance-product-definition.service";
import { prepareProductDefinitionClaim } from "../../modules/product-selection/domain/product-initiative-claim";
import {
  prepareProductDefinitionRelease,
  prepareProductDefinitionWrite,
} from "../../modules/product-selection/domain/product-definition";
import { prepareProductInitiativeDecision } from "../../modules/product-selection/domain/product-initiative";
import { prepareOpportunityIntake } from "../../modules/product-selection/domain/product-opportunity";
import { PrismaProductInitiativeRepository } from "../../modules/product-selection/infrastructure/prisma-product-initiative.repository";
import { PrismaProductOpportunityRepository } from "../../modules/product-selection/infrastructure/prisma-product-opportunity.repository";
import { PrismaProductDefinitionRepository } from "../../modules/product-selection/infrastructure/prisma-product-definition.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_product_def_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
let definitions: PrismaProductDefinitionRepository;
let initiatives: PrismaProductInitiativeRepository;
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
  definitions = new PrismaProductDefinitionRepository(prisma as never);
  initiatives = new PrismaProductInitiativeRepository(prisma as never);
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

describe("产品定义：推进", () => {
  it("首次推进建立一票一行，阶段从 EVT 起", async () => {
    const seeded = await seedHandoff();

    const { record, duplicate } = await write(seeded.handoffId, {});

    expect(duplicate).toBe(false);
    expect(record).toMatchObject({
      initiativeHandoffId: seeded.handoffId,
      npiStage: "evt",
      version: 1,
      releaseState: "in_progress",
      productOwnerActorId: OWNER,
    });
    const again = await definitions.findByInitiativeHandoffId(
      tenantId,
      seeded.handoffId,
    );
    expect(again?.version).toBe(1);
  });

  it("阶段逐级前进，本段结论跟着一起落库", async () => {
    const seeded = await seedHandoff();

    await write(seeded.handoffId, { conclusion: "功能样机通过" });
    const { record } = await write(seeded.handoffId, {
      advanceStage: true,
      expectedDefinitionVersion: 1,
    });

    expect(record.npiStage).toBe("dvt");
    expect(record.stageOutcomes).toMatchObject([
      { stage: "evt", conclusion: "功能样机通过", recordedBy: OWNER },
    ]);
  });

  it("本段结论没登记就想前进时，库里一版都不动", async () => {
    const seeded = await seedHandoff();
    await write(seeded.handoffId, {});

    await expect(
      write(seeded.handoffId, {
        advanceStage: true,
        expectedDefinitionVersion: 1,
      }),
    ).rejects.toThrow(/evt_conclusion/);
    const current = await definitions.findByInitiativeHandoffId(
      tenantId,
      seeded.handoffId,
    );
    expect(current?.npiStage).toBe("evt");
    expect(current?.version).toBe(1);
  });

  it("响应丢了再发一次同样的请求，返回原记录而不是报版本冲突", async () => {
    const seeded = await seedHandoff();
    const service = new AdvanceProductDefinitionService(
      definitions,
      initiatives,
    );
    const command: ProductDefinitionWriteCommandV1 = {
      contractVersion: "product-definition-write.v1",
      expectedDefinitionVersion: 0,
      specification: "40HC 折叠宠物推车",
      complianceAssumptions: ["CE"],
      advanceStage: false,
      idempotencyKey: "same-key",
    };

    const first = await service.execute({
      tenantId,
      actorId: OWNER,
      initiativeHandoffId: seeded.handoffId,
      command,
    });
    // 库里已经有一版了，期望版本 0 已过期 —— 先判重放才不会把成功报成冲突。
    const second = await service.execute({
      tenantId,
      actorId: OWNER,
      initiativeHandoffId: seeded.handoffId,
      command,
    });

    expect(second.definitionId).toBe(first.definitionId);
    expect(second.version).toBe(first.version);
    expect(
      await prisma.productDefinition.count({
        where: { initiativeHandoffId: seeded.handoffId },
      }),
    ).toBe(1);
  });

  it("两个人拿同一期望版本同时推进，只能成一个人", async () => {
    const seeded = await seedHandoff();

    const results = await Promise.allSettled([
      write(seeded.handoffId, { specification: "甲写的规格" }),
      write(seeded.handoffId, { specification: "乙写的规格" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const current = await definitions.findByInitiativeHandoffId(
      tenantId,
      seeded.handoffId,
    );
    expect(current?.version).toBe(1);
  });

  it("别的租户看不到也推不动", async () => {
    const seeded = await seedHandoff();
    const stranger = randomUUID();

    await expect(
      definitions.findByInitiativeHandoffId(stranger, seeded.handoffId),
    ).resolves.toBeNull();
    // 跨租户写不进去：交接快照的复合外键带 tenant_id，别人的票根本引用不上。
    await expect(write(seeded.handoffId, {}, stranger)).rejects.toThrow();
  });
});

describe("产品定义：发布", () => {
  it("发布写下不可变交接快照，带全规格、阶段与各段结论", async () => {
    const seeded = await readyToRelease();

    const { record } = await definitions.persistRelease({
      tenantId,
      definitionId: seeded.definitionId,
      actorId: OWNER,
      command: prepareProductDefinitionRelease(
        MP_STATE(seeded.version),
        OWNER,
        {
          contractVersion: "product-definition-release.v1",
          expectedDefinitionVersion: seeded.version,
          decision: "release",
          idempotencyKey: `release-${randomUUID()}`,
        },
      ),
    });

    expect(record.releaseState).toBe("released");
    const snapshot = await prisma.productDefinitionRelease.findFirstOrThrow({
      where: { definitionId: seeded.definitionId },
    });
    expect(snapshot).toMatchObject({
      npiStage: "mp",
      specification: "已冻结的规格",
      releasedBy: OWNER,
      version: 1,
    });
    expect(snapshot.complianceAssumptions).toEqual(["CE"]);
    expect(snapshot.stageOutcomes).toHaveLength(3);
  });

  it("发布后是终态，不再接受推进", async () => {
    const seeded = await readyToRelease();
    await definitions.persistRelease({
      tenantId,
      definitionId: seeded.definitionId,
      actorId: OWNER,
      command: prepareProductDefinitionRelease(
        MP_STATE(seeded.version),
        OWNER,
        {
          contractVersion: "product-definition-release.v1",
          expectedDefinitionVersion: seeded.version,
          decision: "release",
          idempotencyKey: `release-${randomUUID()}`,
        },
      ),
    });

    await expect(
      write(seeded.handoffId, {
        expectedDefinitionVersion: seeded.version + 1,
      }),
    ).rejects.toThrow(/PRODUCT_DEFINITION_ALREADY_CLOSED/);
  });

  it("暂缓不产生交接快照 —— 没发布就没什么可交给主数据侧", async () => {
    const seeded = await readyToRelease();

    const { record } = await definitions.persistRelease({
      tenantId,
      definitionId: seeded.definitionId,
      actorId: OWNER,
      command: prepareProductDefinitionRelease(
        MP_STATE(seeded.version),
        OWNER,
        {
          contractVersion: "product-definition-release.v1",
          expectedDefinitionVersion: seeded.version,
          decision: "defer",
          reason: "成本超目标，等下一轮议价",
          idempotencyKey: `defer-${randomUUID()}`,
        },
      ),
    });

    expect(record.releaseState).toBe("deferred");
    expect(
      await prisma.productDefinitionRelease.count({
        where: { definitionId: seeded.definitionId },
      }),
    ).toBe(0);
  });
});

/** readyToRelease 推出来的状态：规格与合规假设齐备、三段结论都在。 */
const MP_STATE = (version: number) => ({
  version,
  npiStage: "mp" as const,
  specification: "已冻结的规格",
  complianceAssumptions: ["CE"],
  concludedStages: ["evt", "dvt", "pvt"] as const,
});

/**
 * 推进一版。**当前状态从库里读**（服务层就是这么做的）——
 * 写死"版本 0"会让第二次起必然冲突，那是测试的错，不是实现的错。
 */
async function write(
  initiativeHandoffId: string,
  overrides: {
    specification?: string;
    advanceStage?: boolean;
    expectedDefinitionVersion?: number;
    conclusion?: string;
    idempotencyKey?: string;
  },
  owner = tenantId,
) {
  const current = await definitions.findByInitiativeHandoffId(
    owner,
    initiativeHandoffId,
  );
  return definitions.persistWrite({
    tenantId: owner,
    initiativeHandoffId,
    productOwnerActorId: OWNER,
    actorId: OWNER,
    command: prepareProductDefinitionWrite(
      {
        version: current?.version ?? 0,
        npiStage: current?.npiStage ?? "evt",
        specification: current?.specification ?? null,
        complianceAssumptions: current?.complianceAssumptions ?? [],
        concludedStages: (current?.stageOutcomes ?? []).map(
          (outcome) => outcome.stage,
        ),
      },
      OWNER,
      {
        contractVersion: "product-definition-write.v1",
        expectedDefinitionVersion:
          overrides.expectedDefinitionVersion ?? current?.version ?? 0,
        specification: overrides.specification ?? "40HC 折叠宠物推车",
        complianceAssumptions: ["CE"],
        ...(overrides.conclusion
          ? {
              conclusion: {
                text: overrides.conclusion,
                evidenceRefs: [],
              },
            }
          : {}),
        advanceStage: overrides.advanceStage ?? false,
        idempotencyKey: overrides.idempotencyKey ?? `write-${randomUUID()}`,
      },
    ),
  });
}

/** 推进到 MP 且规格与合规假设齐备 —— 只差发布。 */
async function readyToRelease(): Promise<{
  handoffId: string;
  definitionId: string;
  version: number;
}> {
  const seeded = await seedHandoff();
  let version = 0;
  // 三段结论各写一次并前进一段：EVT → DVT → PVT → MP。
  for (const conclusion of ["功能样机通过", "设计冻结", "试产可行"]) {
    const result = await write(seeded.handoffId, {
      specification: "已冻结的规格",
      conclusion,
      advanceStage: true,
      expectedDefinitionVersion: version,
    });
    version = result.record.version;
  }
  const record = await definitions.findByInitiativeHandoffId(
    tenantId,
    seeded.handoffId,
  );
  return {
    handoffId: seeded.handoffId,
    definitionId: record!.definitionId,
    version,
  };
}

/**
 * 造一票已交到产品侧的立项。**走真实链路**（信号 → 交给选品 → 立项成立），
 * 不手工插行 —— 交接快照的字段与约束由既有实现决定。
 */
async function seedHandoff(): Promise<{ handoffId: string }> {
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
  await acceptOpportunity(
    productOpportunities,
    tenantId,
    decided.handoff!.handoffId,
  );
  const approved = await initiatives.persistDecision({
    tenantId,
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
        objective: "验证宠物出行品类是否值得立项",
        ...PRODUCT_INITIATIVE_TEST_APPROVE_PREREQUISITE,
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
    where: { initiativeId: approved.record.initiativeId, tenantId },
    orderBy: { version: "desc" },
  });
  // 交到产品侧之后还要有人**领取** —— 没领的立项建不了产品定义（这一片的门槛）。
  await initiatives.appendClaim({
    tenantId,
    handoffId: handoff.id,
    command: prepareProductDefinitionClaim(OWNER, `claim-${handoff.id}`),
  });
  return { handoffId: handoff.id };
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

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
