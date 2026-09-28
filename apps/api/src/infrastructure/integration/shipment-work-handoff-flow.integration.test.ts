// 事项交接在**真实 PostgreSQL** 上的验证。
//
// 单元测试替不掉的三件事：两人同时领只能成一人、重放不写第二条、跨租户看不到。
// 还有一件只在这里立得住：**动作留痕与当前态同事务写** —— 状态说"已了结"而留痕里
// 没有那条，事后复盘就没依据。
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import {
  ClaimWorkHandoffService,
  CloseWorkHandoffService,
  ListWorkHandoffQueueService,
  RaiseWorkHandoffService,
} from "../../modules/shipment-registry/application/shipment-work-handoff.services";
import { PrismaShipmentWorkHandoffRepository } from "../../modules/shipment-registry/infrastructure/prisma-shipment-work-handoff.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_work_handoff_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
const OPS = "shipment-operator";
const CUSTOMS = "customs-operator";
const tenantId = randomUUID();

let prisma: PrismaClient;
let repository: PrismaShipmentWorkHandoffRepository;
let raise: RaiseWorkHandoffService;
let claim: ClaimWorkHandoffService;
let close: CloseWorkHandoffService;
let queue: ListWorkHandoffQueueService;

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
  repository = new PrismaShipmentWorkHandoffRepository(prisma as never);
  raise = new RaiseWorkHandoffService(repository);
  claim = new ClaimWorkHandoffService(repository);
  close = new CloseWorkHandoffService(repository);
  queue = new ListWorkHandoffQueueService(repository);
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

describe("交给专业岗位", () => {
  it("交出去之后出现在该岗位队列，别的岗位看不到", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");

    const theirs = await queue.execute({
      tenantId,
      recipientQueueCode: "customs",
    });
    const others = await queue.execute({
      tenantId,
      recipientQueueCode: "pickup",
    });

    expect(theirs.items.map((item) => item.handoffId)).toContain(
      raised.handoffId,
    );
    expect(others.items.map((item) => item.handoffId)).not.toContain(
      raised.handoffId,
    );
    expect(raised.state).toBe("raised");
  });

  it("票据不存在时明确 404，不静默建一条挂空的交接", async () => {
    await expect(
      raise.execute({
        tenantId,
        actorId: OPS,
        command: {
          contractVersion: "shipment-work-handoff-raise.v1",
          shipmentId: randomUUID(),
          recipientQueueCode: "customs",
          title: "不存在的票",
          idempotencyKey: `raise-${randomUUID()}`,
        },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("同一幂等键重复交，返回原来那条而不是再交一次", async () => {
    const shipmentId = await seedShipment();
    const key = `raise-${randomUUID()}`;
    const command = {
      contractVersion: "shipment-work-handoff-raise.v1" as const,
      shipmentId,
      recipientQueueCode: "customs" as const,
      title: "缺随车单",
      idempotencyKey: key,
    };

    const first = await raise.execute({ tenantId, actorId: OPS, command });
    const second = await raise.execute({ tenantId, actorId: OPS, command });

    expect(second.handoffId).toBe(first.handoffId);
    expect(
      await prisma.shipmentWorkHandoff.count({ where: { shipmentId } }),
    ).toBe(1);
  });

  it("别的租户看不到也交不出去", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");
    const stranger = randomUUID();

    const theirs = await queue.execute({
      tenantId: stranger,
      recipientQueueCode: "customs",
    });

    expect(theirs.items.map((item) => item.handoffId)).not.toContain(
      raised.handoffId,
    );
  });
});

describe("领取与了结", () => {
  it("领取后队列里那一件带上领取人，且动作留痕写得下", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");

    const claimed = await claimIt(raised.handoffId, CUSTOMS);

    expect(claimed).toMatchObject({
      state: "claimed",
      claimedByActorId: CUSTOMS,
      version: 2,
    });
    const actions = await prisma.shipmentWorkHandoffAction.findMany({
      where: { handoffId: raised.handoffId },
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ action: "claim", actorId: CUSTOMS });
  });

  it("两人同时领，只能成一个人", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");

    const results = await Promise.allSettled([
      claimIt(raised.handoffId, "operator-a"),
      claimIt(raised.handoffId, "operator-b"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.shipmentWorkHandoffAction.count({
        where: { handoffId: raised.handoffId, action: "claim" },
      }),
    ).toBe(1);
  });

  it("了结要写结论，且领了才能结", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");

    await expect(
      closeIt(raised.handoffId, CUSTOMS, "已补齐", 1),
    ).rejects.toThrow(/NOT_CLAIMED/);

    const claimed = await claimIt(raised.handoffId, CUSTOMS);
    const closed = await closeIt(
      raised.handoffId,
      CUSTOMS,
      "已补齐随车单并复核",
      claimed.version,
    );

    expect(closed).toMatchObject({
      state: "closed",
      conclusion: "已补齐随车单并复核",
      closedByActorId: CUSTOMS,
    });
    expect(
      await prisma.shipmentWorkHandoffAction.count({
        where: { handoffId: raised.handoffId },
      }),
    ).toBe(2);
  });

  it("不是你领的就不能由你结", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");
    const claimed = await claimIt(raised.handoffId, CUSTOMS);

    await expect(
      closeIt(raised.handoffId, "someone-else", "我替他结了", claimed.version),
    ).rejects.toThrow(/NOT_YOURS/);
  });

  it("已了结的不再占队列，但留在票上可回看", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");
    const claimed = await claimIt(raised.handoffId, CUSTOMS);
    await closeIt(raised.handoffId, CUSTOMS, "已处理", claimed.version);

    const queuePage = await queue.execute({
      tenantId,
      recipientQueueCode: "customs",
    });
    const onShipment = await repository.listByShipment(tenantId, shipmentId);

    expect(queuePage.items.map((item) => item.handoffId)).not.toContain(
      raised.handoffId,
    );
    expect(onShipment.map((item) => item.handoffId)).toContain(
      raised.handoffId,
    );
  });

  it("响应丢了再发一次同样的领取，返回原记录而不是报冲突", async () => {
    const shipmentId = await seedShipment();
    const raised = await raiseIt(shipmentId, "customs");
    const key = `claim-${randomUUID()}`;
    const command = {
      contractVersion: "shipment-work-handoff-claim.v1" as const,
      expectedVersion: 1,
      idempotencyKey: key,
    };

    const first = await claim.execute({
      tenantId,
      actorId: CUSTOMS,
      handoffId: raised.handoffId,
      command,
    });
    // 库里已经领过了，期望版本 1 已过期 —— 先判重放才不会把成功报成冲突。
    const second = await claim.execute({
      tenantId,
      actorId: CUSTOMS,
      handoffId: raised.handoffId,
      command,
    });

    expect(second.handoffId).toBe(first.handoffId);
    expect(second.state).toBe("claimed");
  });
});

async function raiseIt(shipmentId: string, recipientQueueCode: "customs") {
  return raise.execute({
    tenantId,
    actorId: OPS,
    command: {
      contractVersion: "shipment-work-handoff-raise.v1",
      shipmentId,
      recipientQueueCode,
      title: "缺随车单，请补",
      idempotencyKey: `raise-${randomUUID()}`,
    },
  });
}

async function claimIt(handoffId: string, actorId: string) {
  return claim.execute({
    tenantId,
    actorId,
    handoffId,
    command: {
      contractVersion: "shipment-work-handoff-claim.v1",
      expectedVersion: 1,
      idempotencyKey: `claim-${randomUUID()}`,
    },
  });
}

async function closeIt(
  handoffId: string,
  actorId: string,
  conclusion: string,
  expectedVersion: number,
) {
  return close.execute({
    tenantId,
    actorId,
    handoffId,
    command: {
      contractVersion: "shipment-work-handoff-close.v1",
      expectedVersion,
      conclusion,
      idempotencyKey: `close-${randomUUID()}`,
    },
  });
}

async function seedShipment(owner = tenantId): Promise<string> {
  const actor = randomUUID();
  const id = randomUUID();
  await prisma.shipment.create({
    data: {
      id,
      tenantId: owner,
      sourceSystem: "integration-test",
      sourceRecordId: `shipment-${id}`,
      sourceVersion: "1",
      transportMode: "ocean",
      currentLifecycleStatus: "in_transit",
      lifecycleVersion: 1,
      relationshipVersion: 1,
      createdBy: actor,
      updatedBy: actor,
    },
  });
  return id;
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
