// 风险队列在**真实 PostgreSQL** 上的验证。
//
// 这一片最容易写出"翻页悄悄丢行"的缺陷：排序值是跨三跳的聚合，keyset 游标要
// 同时处理"有截止"和"无截止"两段。单元测试只能盯住 SQL 文本的形状，**不重不漏
// 必须在真库上翻着页量出来**。
//
// 另外两条口径在这里对拍：
// 1. SQL 排出来的顺序 vs 各行自己写明的截止 —— "为什么排在这"和"排在第几"
//    必须出自同一份事实；
// 2. SQL 的缺口口径 vs `listPendingCompletion` 的 Prisma 口径 —— 两份实现
//    若分叉，队列和待补列表会互相矛盾。
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ShipmentRiskSortV1 } from "@logix/contracts";
import { PrismaClient } from "../../../../../../generated/prisma";
import { createPostgresAdapter } from "../../../prisma/postgres-adapter";
import { ListShipmentRiskQueueService } from "../application/list-shipment-risk-queue.service";
import { OPEN_EXCEPTION_STATUSES } from "../domain/shipment-risk";
import { PrismaShipmentReadRepository } from "./prisma-shipment-read.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_risk_queue_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
const SORTS: ShipmentRiskSortV1[] = [
  "nearest_deadline",
  "eta",
  "task_due",
  "updated_at",
];
const NOW = new Date("2026-09-27T00:00:00.000Z");
const days = (offset: number) =>
  new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

let prisma: PrismaClient;
let repository: PrismaShipmentReadRepository;
let service: ListShipmentRiskQueueService;
const tenantId = randomUUID();

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
  repository = new PrismaShipmentReadRepository(prisma as never);
  service = new ListShipmentRiskQueueService(repository);

  // 两条**完全没有截止**的票（无预计到港、工单也没有 due），靠缺口进队列。
  // 它们排在每个截止类排序的最后一段 —— 跨段翻页是最容易丢行的地方，
  // 所以放在这里让每个排序的分页测试都能走到。
  await seed({ gaps: true, etaAt: null });
  await seed({ gaps: true, etaAt: null });
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

describe("风险队列：有事可做才收", () => {
  it("资料齐全、没有任何待办的票不进队列 —— 哪怕到港时间就是明天", async () => {
    // 到港时间是事实，不是待办。把它排进首屏就是替业务编造紧迫度。
    const clean = await seed({ complete: true, etaAt: days(1) });

    expect(ids(await queue({ take: 500 }))).not.toContain(clean.shipmentId);
  });

  it("有缺口、有未完成工单、有未解决异常的票都进队列", async () => {
    const gapped = await seed({ gaps: true });
    const withTask = await seed({ complete: true, taskDueAt: days(3) });
    const withOwnException = await seed({
      complete: true,
      ownOpenExceptions: 1,
    });
    const withUnassignedException = await seed({
      complete: true,
      unassignedOpenExceptions: 1,
    });
    const openTaskWithoutDue = await seed({
      complete: true,
      openTaskWithoutDue: true,
    });

    expect(ids(await queue({ take: 500 }))).toEqual(
      expect.arrayContaining([
        gapped.shipmentId,
        withTask.shipmentId,
        withOwnException.shipmentId,
        withUnassignedException.shipmentId,
        openTaskWithoutDue.shipmentId,
      ]),
    );
  });

  it("别的租户的票一条都不出现", async () => {
    const theirs = await seed({ tenantId: randomUUID(), gaps: true });

    expect(ids(await queue({ take: 500 }))).not.toContain(theirs.shipmentId);
  });
});

describe("风险队列：分页不重不漏", () => {
  it.each(SORTS)("%s 用服务端游标逐页翻完，既无重复也无遗漏", async (sort) => {
    const whole = await queue({ sort, take: 500 });
    expect(whole.length).toBeGreaterThan(4);

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 50; guard += 1) {
      const page = await service.execute({
        tenantId,
        sort,
        pageSize: "2",
        cursor,
      });
      seen.push(...page.items.map(({ shipment }) => shipment.id));
      if (!page.pageInfo.hasNextPage) break;
      cursor = page.pageInfo.nextCursor ?? undefined;
      if (!cursor) throw new Error("HAS_NEXT_PAGE_WITHOUT_CURSOR");
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(whole.map((row) => row.shipment.id));
  });

  it("没有截止的票排在最后，翻页跨过那一段也不丢行", async () => {
    const page = await queue({ sort: "nearest_deadline", take: 500 });
    const firstNull = page.findIndex((row) => row.sortValue === null);

    expect(firstNull).toBeGreaterThan(-1);
    expect(page.slice(firstNull).every((row) => row.sortValue === null)).toBe(
      true,
    );
    // 无截止那一段至少有 2 票，否则跨段翻页没被真正走到。
    expect(page.length - firstNull).toBeGreaterThan(1);
  });
});

describe("风险队列：排序用的截止", () => {
  it("最近截止取「预计到港」与「最早未完成工单截止」中更早的那个", async () => {
    // 独立租户，避免受上面那些夹具影响，顺序可以逐条断言。
    const owner = randomUUID();
    const taskFirst = await seed({
      tenantId: owner,
      complete: true,
      etaAt: days(10),
      taskDueAt: days(1),
    });
    const etaFirst = await seed({
      tenantId: owner,
      complete: true,
      etaAt: days(2),
      taskDueAt: days(9),
    });
    const onlyEta = await seed({
      tenantId: owner,
      gaps: true,
      etaAt: days(5),
    });
    const onlyTask = await seed({
      tenantId: owner,
      complete: true,
      etaAt: null,
      taskDueAt: days(6),
    });

    const rows = await repository.listRiskQueue({
      tenantId: owner,
      sort: "nearest_deadline",
      take: 50,
    });

    expect(rows.map((row) => row.shipment.id)).toEqual([
      taskFirst.shipmentId,
      etaFirst.shipmentId,
      onlyEta.shipmentId,
      onlyTask.shipmentId,
    ]);
    expect(rows.map((row) => row.sortValue?.getTime())).toEqual([
      days(1).getTime(),
      days(2).getTime(),
      days(5).getTime(),
      days(6).getTime(),
    ]);
    // 只有一条截止时，写的也要是那一条 —— 不能因为另一条缺失就报"没有截止"。
    expect(rows.map((row) => row.risk.nearestDeadline?.kind)).toEqual([
      "task_due",
      "eta",
      "eta",
      "task_due",
    ]);
  });

  it("每一行写明的最近截止，就是它排序用的那个值", async () => {
    const page = await queue({ sort: "nearest_deadline", take: 500 });

    expect(page.length).toBeGreaterThan(0);
    for (const row of page) {
      expect(row.risk.nearestDeadline?.at ?? null).toBe(
        row.sortValue?.toISOString() ?? null,
      );
    }
  });
});

describe("风险队列：异常口径", () => {
  it("挂在货柜上、没有落到票的异常算在本票头上，且与落到票的不重复计数", async () => {
    const seeded = await seed({
      complete: true,
      ownOpenExceptions: 2,
      unassignedOpenExceptions: 3,
    });

    const row = (await queue({ take: 500 })).find(
      (entry) => entry.shipment.id === seeded.shipmentId,
    );

    expect(row?.risk).toMatchObject({
      openExceptionCount: 2,
      unassignedExceptionCount: 3,
    });
    expect(row?.risk.reasons).toEqual(
      expect.arrayContaining(["open_exceptions", "unassigned_exceptions"]),
    );
  });

  it("已解决的异常不算风险，也不把票拉进队列", async () => {
    const seeded = await seed({ complete: true, ownResolvedExceptions: 2 });

    const page = await queue({ take: 500 });

    expect(ids(page)).not.toContain(seeded.shipmentId);
  });
});

describe("风险队列：缺口口径与待补列表对拍", () => {
  it("待补列表里的票，一票都不能从队列里漏掉", async () => {
    await seed({ gaps: true });

    const pending = await repository.listPendingCompletion({
      tenantId,
      take: 200,
    });

    expect(pending.length).toBeGreaterThan(0);
    const queueIds = new Set(ids(await queue({ take: 500 })));
    for (const entry of pending) {
      expect(queueIds).toContain(entry.shipment.id);
    }
  });

  it("队列里带着待补项的票，也必须出现在待补列表里", async () => {
    const pending = new Set(
      (await repository.listPendingCompletion({ tenantId, take: 200 })).map(
        (entry) => entry.shipment.id,
      ),
    );
    const withPendingItems = (await queue({ take: 500 })).filter(
      (row) => row.pendingItems.length > 0,
    );

    expect(withPendingItems.length).toBeGreaterThan(0);
    for (const row of withPendingItems) {
      expect(pending).toContain(row.shipment.id);
    }
  });

  it("队列正好等于「有待办 ∪ 有缺口 ∪ 有未解决异常」，一条不多一条不少", async () => {
    // 这是唯一能抓住"SQL 口径比 Prisma 宽"的分叉的断言：口径偏宽时多出来的票
    // 既没有待补项也没有理由，上面两条对拍都发现不了。
    const queueIds = new Set(ids(await queue({ take: 500 })));

    const links = await prisma.shipmentContainerLink.findMany({
      where: { tenantId, state: "active", supersededAt: null },
      select: { shipmentId: true, containerRecordId: true },
    });
    const containerIds = links.map((link) => link.containerRecordId);

    // 有未完成工单。`node_task.container_id` 是逻辑引用（无外键），Prisma 走不了
    // 这条关系，只能先拿货柜再按 containerId 找。
    const openTaskNodes = await prisma.nodeTask.findMany({
      where: {
        tenantId,
        containerId: { in: containerIds },
        workOrders: { some: { state: { not: "completed" } } },
      },
      select: { containerId: true },
    });
    const taskContainerIds = new Set(
      openTaskNodes.map((node) => node.containerId),
    );

    // 有缺口（Prisma 口径）。
    const pendingIds = new Set(
      (await repository.listPendingCompletion({ tenantId, take: 500 })).map(
        (entry) => entry.shipment.id,
      ),
    );

    // 有未解决异常：直接挂票的，或挂在本票在链货柜上、没落到票的。
    const ownExceptionRows = await prisma.operationalExceptionCase.findMany({
      where: {
        tenantId,
        status: { in: [...OPEN_EXCEPTION_STATUSES] },
        shipmentId: { not: null },
      },
      select: { shipmentId: true },
    });
    const unassignedRows = await prisma.operationalExceptionCase.findMany({
      where: {
        tenantId,
        status: { in: [...OPEN_EXCEPTION_STATUSES] },
        shipmentId: null,
        containerRecordId: { in: containerIds },
      },
      select: { containerRecordId: true },
    });
    const exceptionContainerIds = new Set(
      unassignedRows.map((row) => row.containerRecordId),
    );

    const expected = new Set<string>(pendingIds);
    for (const link of links) {
      if (taskContainerIds.has(link.containerRecordId)) {
        expected.add(link.shipmentId);
      }
      if (exceptionContainerIds.has(link.containerRecordId)) {
        expected.add(link.shipmentId);
      }
    }
    for (const row of ownExceptionRows) expected.add(row.shipmentId!);

    // 每一类都要有票，否则这条断言可能因为凑巧空集而形同虚设。
    expect(pendingIds.size).toBeGreaterThan(0);
    expect(taskContainerIds.size).toBeGreaterThan(0);
    expect(ownExceptionRows.length).toBeGreaterThan(0);
    expect(unassignedRows.length).toBeGreaterThan(0);

    expect([...queueIds].sort()).toEqual([...expected].sort());
  });
});

function queue(overrides: {
  sort?: ShipmentRiskSortV1;
  take: number;
  after?: { sortValue: Date | null; id: string };
}) {
  return repository.listRiskQueue({
    tenantId,
    sort: overrides.sort ?? "nearest_deadline",
    after: overrides.after,
    take: overrides.take,
  });
}

const ids = (rows: { shipment: { id: string } }[]) =>
  rows.map((row) => row.shipment.id);

/**
 * 造一票。缺省**什么待办都不给**，由调用方按需加 —— "加没加"的差别正是测试
 * 要断言的那一条。
 */
async function seed(
  options: {
    tenantId?: string;
    /** 留空票面事实（缺船公司），制造缺口 */
    gaps?: boolean;
    /** 补齐货线与提单，使缺口口径不成立 */
    complete?: boolean;
    etaAt?: Date | null;
    taskDueAt?: Date | null;
    openTaskWithoutDue?: boolean;
    ownOpenExceptions?: number;
    ownResolvedExceptions?: number;
    unassignedOpenExceptions?: number;
  } = {},
): Promise<{ shipmentId: string; containerId: string }> {
  const owner = options.tenantId ?? tenantId;
  const shipmentId = randomUUID();
  const containerId = randomUUID();
  const handoffId = randomUUID();
  const actorId = randomUUID();
  const occurredAt = new Date("2026-09-22T10:00:00.000Z");

  await prisma.shipment.create({
    data: {
      id: shipmentId,
      tenantId: owner,
      sourceSystem: "integration-test",
      sourceRecordId: `shipment-${shipmentId}`,
      sourceVersion: "1",
      transportMode: "ocean",
      carrierCode: options.gaps ? null : "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originCountryCode: "CN",
      originUnlocode: "CNNGB",
      destinationCountryCode: "US",
      destinationUnlocode: "USLAX",
      atdAt: occurredAt,
      etaAt: options.etaAt === undefined ? days(5) : options.etaAt,
      currentLifecycleStatus: "departed",
      lifecycleVersion: 1,
      relationshipVersion: 1,
      createdBy: actorId,
      updatedBy: actorId,
    },
  });
  await prisma.shipmentHandoffRecord.create({
    data: {
      id: handoffId,
      tenantId: owner,
      sourceProfile: "api_v1",
      ingestionChannel: "api",
      sourceSystem: "integration-test",
      externalHandoffId: `handoff-${handoffId}`,
      handoffVersion: 1,
      occurredAt,
      idempotencyKey: `handoff-${handoffId}`,
      payloadHash: "a".repeat(64),
      payloadJson: {},
      status: "accepted",
      shipmentId,
      actorId,
      traceId: `trace-${handoffId}`,
    },
  });
  await prisma.containerRecord.create({
    data: {
      id: containerId,
      tenantId: owner,
      containerNumber: `HMMU${containerId.slice(0, 7)}`,
      currentStatus: "shipped",
    },
  });
  await prisma.shipmentContainerLink.create({
    data: {
      id: randomUUID(),
      tenantId: owner,
      shipmentId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      sourceHandoffId: handoffId,
      evidenceRefs: [],
      idempotencyKey: `link-${containerId}`,
      joinedAt: occurredAt,
    },
  });

  if (options.complete) await addCompleteCargo(owner, shipmentId, handoffId);
  if (options.taskDueAt != null || options.openTaskWithoutDue) {
    await addOpenTask(owner, containerId, {
      dueAt: options.openTaskWithoutDue ? null : (options.taskDueAt ?? null),
    });
  }
  await addExceptions(owner, containerId, {
    shipmentId,
    status: "open",
    count: options.ownOpenExceptions ?? 0,
  });
  await addExceptions(owner, containerId, {
    shipmentId,
    status: "resolved",
    count: options.ownResolvedExceptions ?? 0,
  });
  await addExceptions(owner, containerId, {
    status: "open",
    count: options.unassignedOpenExceptions ?? 0,
  });

  return { shipmentId, containerId };
}

async function addCompleteCargo(
  owner: string,
  shipmentId: string,
  handoffId: string,
): Promise<void> {
  const productSkuId = randomUUID();
  await prisma.productSku.create({
    data: {
      id: productSkuId,
      tenantId: owner,
      productNumber: `SKU-${productSkuId.slice(0, 8)}`,
    },
  });
  await prisma.shipmentCargoLine.create({
    data: {
      id: randomUUID(),
      tenantId: owner,
      shipmentId,
      lineNo: 1,
      productSkuId,
      productNumberSnapshot: "SKU-COMPLETE",
      quantity: "10",
      quantityUnit: "CTN",
      sourceHandoffId: handoffId,
      sourceLineId: `line-${shipmentId}`,
      version: 1,
      state: "active",
    },
  });
  await prisma.shipmentTransportDocument.create({
    data: {
      id: randomUUID(),
      tenantId: owner,
      shipmentId,
      documentType: "mbl",
      documentNumber: `MBL-${shipmentId.slice(0, 8)}`,
      version: 1,
      state: "active",
      sourceHandoffId: handoffId,
      effectiveFrom: new Date("2026-09-22T10:00:00.000Z"),
    },
  });
}

async function addOpenTask(
  owner: string,
  containerId: string,
  options: { dueAt: Date | null },
): Promise<void> {
  const nodeTaskId = randomUUID();
  await prisma.nodeTask.create({
    data: {
      id: nodeTaskId,
      tenantId: owner,
      flowInstanceId: randomUUID(),
      nodeInstanceId: randomUUID(),
      nodeCode: "customs_clearance",
      containerId,
      taskDefinitionKey: "customs_clearance",
      state: "in_progress",
    },
  });
  await prisma.workOrder.create({
    data: {
      id: randomUUID(),
      nodeTaskId,
      workOrderDefinitionKey: "customs_clearance",
      state: "in_progress",
      applicability: "required",
      assignmentState: "assigned",
      dueAt: options.dueAt,
    },
  });
}

async function addExceptions(
  owner: string,
  containerId: string,
  options: { shipmentId?: string; status: string; count: number },
): Promise<void> {
  for (let index = 0; index < options.count; index += 1) {
    const id = randomUUID();
    await prisma.operationalExceptionCase.create({
      data: {
        id,
        tenantId: owner,
        containerRecordId: containerId,
        shipmentId: options.shipmentId ?? null,
        exceptionCode: "customs_hold",
        severity: "high",
        status: options.status,
        sourceDomain: "customs-compliance",
        sourceRecordId: `case-${id}`,
        sourceVersion: "1",
        occurredAt: new Date("2026-09-23T10:00:00.000Z"),
        resolvedAt:
          options.status === "resolved"
            ? new Date("2026-09-24T10:00:00.000Z")
            : null,
        evidenceRefs: [],
        idempotencyKey: `case-${id}`,
      },
    });
  }
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
