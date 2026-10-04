// 迁移的"旧版本升级"验证。
//
// 现有集成测试覆盖的是**空库**（每次独立 schema、从零跑完所有迁移）。这里覆盖
// 另一条真实路径：一个**已有业务数据、停在上一版本**的库，接上
// `20260927120000_add_product_initiative` 之后必须干净升级 —— 既有行不动、新
// 外键能对上既有数据、新约束真的拦得住半状态。
//
// "停在上一版本"不靠另建一套迁移目录，而是：正常跑完全部迁移、灌入业务数据，
// 再把该迁移建的两张表删掉并从 `_prisma_migrations` 里除去它的记录 —— 这正是
// 应用那条迁移之前数据库的样子。这样用的是仓库自己的 `pnpm db:migrate` 入口，
// 不必复制 `scripts/migrate-deploy.mjs` 里那段历史迁移恢复逻辑。
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import {
  normalizeMarketSignalCreate,
  prepareMarketSignalDecision,
} from "../../modules/market-intelligence/domain/market-signal";
import { PrismaMarketSignalRepository } from "../../modules/market-intelligence/infrastructure/prisma-market-signal.repository";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";

const INITIATIVE_MIGRATION = "20260927120000_add_product_initiative";
const CLAIM_MIGRATION = "20260927180000_add_product_initiative_claim";
const DEFINITION_MIGRATION = "20260927190000_add_product_definition";
const IDENTITY_MIGRATION = "20260927200000_add_product_identity";
const ATTRIBUTES_MIGRATION = "20260927210000_add_product_attributes";
const NOMINATION_MIGRATION = "20260928120000_add_supplier_nomination";
const RESOURCE_COMMITMENT_MIGRATION =
  "20261004160000_add_product_initiative_resource_commitment";
const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_pi_upgrade_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
let prisma: PrismaClient;
let marketSignals: PrismaMarketSignalRepository;
let tenantId: string;
let handoffId: string;

beforeAll(async () => {
  deploy();

  prisma = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
  await prisma.$connect();
  marketSignals = new PrismaMarketSignalRepository(prisma as never);

  // 升级前就存在的业务事实：一个信号 + 一份交到选品的机会。
  const seeded = await seedOpportunity();
  tenantId = seeded.tenantId;
  handoffId = seeded.handoffId;

  // 退回"应用该迁移之前"：删掉它建的对象，并抹掉它的记账，让下一次迁移认为它是待应用。
  //
  // 原生 SQL 必须显式带上 schema 名：适配器的 schema 选项只作用于 Prisma 自己的
  // 查询，裸 SQL 里不带 schema 的表名会落到 search_path 的 public 上 —— 那样会
  // 删错库里的表、且让迁移器以为这条迁移早已应用。
  //
  // **更晚的迁移必须一起回退**：`product_initiative_claim` 外键依赖这两张表，
  // 只删表会因依赖删不掉；只删表不抹记账则会留下"记账说已应用、表却不在"的半状态。
  // `product` 外键依赖 product_definition_release，而 product_sku 又挂了 product 的外键 ——
  // 回退要按依赖反序，连 product_sku 上新增的那一列一起收。
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."product_sku" DROP CONSTRAINT IF EXISTS "product_sku_product_fkey"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."product_sku" DROP CONSTRAINT IF EXISTS "product_sku_attributes_check"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."product_sku" DROP COLUMN IF EXISTS "attributes"`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${schemaName}"."product_sku" DROP COLUMN IF EXISTS "product_id"`,
  );
  // `supplier_quotation` / `supplier_nomination_release` 外键依赖它，依赖反序收。
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."supplier_nomination_release"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."supplier_quotation"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."supplier"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product_identity_release"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product_definition_release"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product_definition"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product_initiative_claim"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product_initiative_handoff"`,
  );
  await prisma.$executeRawUnsafe(
    `DROP TABLE IF EXISTS "${schemaName}"."product_initiative"`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM "${schemaName}"."_prisma_migrations" WHERE "migration_name" = ANY($1)`,
    [
      INITIATIVE_MIGRATION,
      CLAIM_MIGRATION,
      DEFINITION_MIGRATION,
      IDENTITY_MIGRATION,
      ATTRIBUTES_MIGRATION,
      NOMINATION_MIGRATION,
      RESOURCE_COMMITMENT_MIGRATION,
    ],
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

describe("product initiative migration upgrade", () => {
  it("升级后原有的信号与交还原样还在", async () => {
    const handoff = await prisma.marketOpportunityHandoff.findUniqueOrThrow({
      where: { id: handoffId },
    });

    expect(handoff.tenantId).toBe(tenantId);
    expect(handoff.title).toBe("加拿大站宠物出行需求上升");
    expect(handoff.recipientQueueCode).toBe("product_selection");
  });

  it("升级把上一条迁移创建的外键接上了，能引用升级前就存在的交", async () => {
    await expect(
      insertInitiative({
        outcome: "defer",
        completionState: "completed",
        currentDestination: "deferred",
        reason: "证据不足",
      }),
    ).resolves.toBeUndefined();
  });

  it("挂到不存在的交上被外键拦住", async () => {
    await expect(
      insertInitiative(
        {
          outcome: "defer",
          completionState: "completed",
          currentDestination: "deferred",
          reason: "证据不足",
        },
        { handoffId: randomUUID() },
      ),
    ).rejects.toThrow(/product_initiative_handoff_fkey/);
  });

  it("半状态在升级后的库上同样被约束拦住", async () => {
    // 已暂缓却没有原因：既不是"关闭"，也不是"待补"，必须明确失败。
    await expect(
      insertInitiative({
        outcome: "defer",
        completionState: "completed",
        currentDestination: "deferred",
        reason: null,
      }),
    ).rejects.toThrow(/product_initiative_shape_check/);
  });

  it("记账对得上：该迁移在升级前是待应用，升级后是已应用", async () => {
    const rows = await prisma.$queryRawUnsafe<
      { migration_name: string; finished_at: Date | null }[]
    >(
      `SELECT "migration_name", "finished_at" FROM "${schemaName}"."_prisma_migrations" WHERE "migration_name" = $1`,
      INITIATIVE_MIGRATION,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.finished_at).toBeInstanceOf(Date);
  });
});

function deploy(): void {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  try {
    execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
      cwd: repositoryRoot,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "pipe",
    });
  } catch (error) {
    // execFileSync 的默认报错只有命令，不带迁移器说了什么；这里补上，否则
    // 迁移失败时排查不到是哪条 SQL 或哪个约束。
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `MIGRATION_DEPLOY_FAILED\n${output.stdout?.toString() ?? ""}\n${
        output.stderr?.toString() ?? ""
      }`,
      { cause: error },
    );
  }
}

async function insertInitiative(
  fields: {
    outcome: string;
    completionState: string;
    currentDestination: string;
    reason: string | null;
  },
  overrides: { handoffId?: string } = {},
): Promise<void> {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}"."product_initiative" (
       "id", "tenant_id", "handoff_id", "version", "outcome", "completion_state",
       "current_destination", "responsible_actor_id", "objective", "review_points",
       "reason", "pending_field_codes", "acted_by", "idempotency_key", "payload_hash",
       "validation_focus", "reconsideration_date"
     ) VALUES ($1,$2,$3,1,$4,$5,$6,'selector-1',NULL,'[]'::jsonb,$7,'{}'::text[],'selector-1',$8,
       repeat('a',64),$9,'2099-12-31')`,
    id,
    tenantId,
    overrides.handoffId ?? handoffId,
    fields.outcome,
    fields.completionState,
    fields.currentDestination,
    fields.reason,
    `decision:${id}`,
    fields.reason ?? "测试夹具验证重点",
  );
}

async function seedOpportunity(): Promise<{
  tenantId: string;
  handoffId: string;
}> {
  const seededTenantId = randomUUID();
  const signalId = randomUUID();
  const created = await marketSignals.create({
    tenantId: seededTenantId,
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
    tenantId: seededTenantId,
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
  return { tenantId: seededTenantId, handoffId: decided.handoff!.handoffId };
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

describe("resource commitment migration upgrade", () => {
  const migration = "20261004160000_add_product_initiative_resource_commitment";
  const upgradeSchema = `it_pi_commit_upgrade_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const upgradeDatabaseUrl = withSchema(BASE_DATABASE_URL, upgradeSchema);
  let upgradePrisma: PrismaClient;
  let legacyInitiativeId: string;

  beforeAll(async () => {
    deployAt(upgradeDatabaseUrl);
    upgradePrisma = new PrismaClient({
      adapter: createPostgresAdapter(upgradeDatabaseUrl, upgradeSchema),
    });
    await upgradePrisma.$connect();

    const repository = new PrismaMarketSignalRepository(upgradePrisma as never);
    const seeded = await seedOpportunityForUpgrade(repository, upgradePrisma);
    legacyInitiativeId = randomUUID();
    await upgradePrisma.$executeRawUnsafe(
      `DROP INDEX "${upgradeSchema}"."product_initiative_reconsideration_queue_idx"`,
    );
    await upgradePrisma.$executeRawUnsafe(
      `ALTER TABLE "${upgradeSchema}"."product_initiative"
         DROP CONSTRAINT "product_initiative_resource_commitment_shape_check",
         DROP CONSTRAINT "product_initiative_defer_plan_shape_check",
         DROP CONSTRAINT "product_initiative_commitment_text_check",
         DROP COLUMN "responsibility_accepted",
         DROP COLUMN "receiving_team_or_role",
         DROP COLUMN "resource_description",
         DROP COLUMN "target_date",
         DROP COLUMN "next_decision_date",
         DROP COLUMN "next_decision_question",
         DROP COLUMN "validation_focus",
         DROP COLUMN "reconsideration_date"`,
    );
    await upgradePrisma.$executeRawUnsafe(
      `ALTER TABLE "${upgradeSchema}"."product_initiative_handoff"
         DROP CONSTRAINT "product_initiative_handoff_resource_commitment_shape_check",
         DROP CONSTRAINT "product_initiative_handoff_commitment_text_check",
         DROP COLUMN "responsibility_accepted",
         DROP COLUMN "receiving_team_or_role",
         DROP COLUMN "resource_description",
         DROP COLUMN "target_date",
         DROP COLUMN "next_decision_date",
         DROP COLUMN "next_decision_question"`,
    );
    await upgradePrisma.$executeRawUnsafe(
      `ALTER TABLE "${upgradeSchema}"."product_initiative" DROP CONSTRAINT "product_initiative_pending_codes_check"`,
    );
    await upgradePrisma.$executeRawUnsafe(
      `ALTER TABLE "${upgradeSchema}"."product_initiative" ADD CONSTRAINT "product_initiative_pending_codes_check" CHECK (
        "pending_field_codes" <@ ARRAY['objective','target_user_and_market','competitive_supply','price_band_and_margin','compliance_risk','customer_feedback','defer_reason','reject_reason','return_basis','return_reason']::TEXT[]
      )`,
    );
    await upgradePrisma.$executeRawUnsafe(
      `INSERT INTO "${upgradeSchema}"."product_initiative" (
         "id", "tenant_id", "handoff_id", "version", "outcome", "completion_state",
         "current_destination", "responsible_actor_id", "objective", "review_points",
         "reason", "return_basis", "pending_field_codes", "acted_by", "idempotency_key", "payload_hash"
       ) VALUES ($1,$2,$3,1,'defer','completed','deferred','selector-legacy',NULL,'[]'::jsonb,
         '等待样本',NULL,'{}'::text[],'selector-legacy',$4,repeat('a',64))`,
      legacyInitiativeId,
      seeded.tenantId,
      seeded.handoffId,
      `legacy:${legacyInitiativeId}`,
    );
    await upgradePrisma.$executeRawUnsafe(
      `DELETE FROM "${upgradeSchema}"."_prisma_migrations" WHERE "migration_name" = $1`,
      migration,
    );
    deployAt(upgradeDatabaseUrl);
  }, 180_000);

  afterAll(async () => {
    await upgradePrisma?.$disconnect();
    const admin = new PrismaClient({
      adapter: createPostgresAdapter(
        withSchema(BASE_DATABASE_URL, "public"),
        "public",
      ),
    });
    try {
      await admin.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${upgradeSchema}" CASCADE`,
      );
    } finally {
      await admin.$disconnect();
    }
  });

  it("keeps the existing initiative and leaves new facts unknown", async () => {
    const row = await upgradePrisma.productInitiative.findUniqueOrThrow({
      where: { id: legacyInitiativeId },
    });
    expect(row).toMatchObject({
      outcome: "defer",
      currentDestination: "deferred",
      reason: "等待样本",
      responsibilityAccepted: null,
      receivingTeamOrRole: null,
      validationFocus: null,
      reconsiderationDate: null,
    });
  });

  it("rejects a partial resource commitment", async () => {
    await expect(
      upgradePrisma.productInitiative.update({
        where: { id: legacyInitiativeId },
        data: {
          receivingTeamOrRole: "NPI",
          completionState: "pending_completion",
          currentDestination: "needs_decision",
          reason: null,
        },
      }),
    ).rejects.toThrow(/product_initiative_resource_commitment_shape_check/);
  });
});

function deployAt(databaseUrl: string): void {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

async function seedOpportunityForUpgrade(
  repository: PrismaMarketSignalRepository,
  client: PrismaClient,
): Promise<{ tenantId: string; handoffId: string }> {
  const seededTenantId = randomUUID();
  const signalId = randomUUID();
  const created = await repository.create({
    tenantId: seededTenantId,
    actorId: "market-owner",
    command: normalizeMarketSignalCreate({
      contractVersion: "market-signal-create.v1",
      requestId: signalId,
      title: "加拿大站宠物出行需求上升",
      marketCode: "CA",
      idempotencyKey: `create:${signalId}`,
    }),
  });
  const decided = await repository.decide({
    tenantId: seededTenantId,
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
  await client.productOpportunityIntake.create({
    data: {
      id: randomUUID(),
      tenantId: seededTenantId,
      handoffId: decided.handoff!.handoffId,
      version: 1,
      state: "accepted",
      assignedActorId: "selector-legacy",
      actedBy: "selector-legacy",
      actedAt: new Date(),
      idempotencyKey: `accept:${signalId}`,
      payloadHash: "b".repeat(64),
    },
  });
  return {
    tenantId: seededTenantId,
    handoffId: decided.handoff!.handoffId,
  };
}
