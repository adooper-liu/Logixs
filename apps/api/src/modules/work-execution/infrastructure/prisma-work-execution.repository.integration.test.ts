import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import type { ReconcileAppliedLifecycleFactCommand } from "../reconcile-applied-lifecycle-fact.port";
import { ReconcileAppliedLifecycleFactService } from "../application/reconcile-applied-lifecycle-fact.service";
import { CompleteWorkOrderService } from "../application/complete-work-order.service";
import {
  buildCommittedClientOperation,
  WORK_CLAIM_ACTION,
  WORK_COMPLETE_ACTION,
} from "../domain/client-operation";
import { PrismaWorkClientOperationRepository } from "./prisma-client-operation.repository";
import { PrismaWorkExecutionRepository } from "./prisma-work-execution.repository";
import { createPostgresAdapter } from "../../../prisma/postgres-adapter";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_work_fact_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../../..");
let prisma: PrismaClient;
let repository: PrismaWorkExecutionRepository;
let service: ReconcileAppliedLifecycleFactService;
let completeService: CompleteWorkOrderService;

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
  repository = new PrismaWorkExecutionRepository(prisma as never);
  service = new ReconcileAppliedLifecycleFactService(repository);
  completeService = new CompleteWorkOrderService(
    repository,
    new PrismaWorkClientOperationRepository(prisma as never),
    { execute: async () => undefined },
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

describe("PrismaWorkExecutionRepository lifecycle fact reconciliation", () => {
  it("并发同键同载荷只写一条应用、一次迁移和一个 Outcome", async () => {
    const fixture = await createFixture();

    const [first, second] = await Promise.all([
      service.execute(fixture.command),
      service.execute(fixture.command),
    ]);

    expect(first).toEqual(second);
    await expectCounts(fixture, { applications: 1, outcomes: 1 });
    const workOrder = await prisma.workOrder.findUniqueOrThrow({
      where: { id: fixture.workOrderId },
    });
    const task = await prisma.nodeTask.findUniqueOrThrow({
      where: { id: fixture.taskId },
    });
    expect(workOrder).toMatchObject({ state: "completed", version: 1 });
    expect(task).toMatchObject({ state: "completed", version: 1 });
  });

  it("并发同键异载荷一方成功，另一方明确幂等冲突", async () => {
    const fixture = await createFixture();

    const results = await Promise.allSettled([
      service.execute(fixture.command),
      service.execute({
        ...fixture.command,
        captureSource: "manual_backfill",
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "IDEMPOTENCY_CONFLICT" }),
    });
    await expectCounts(fixture, { applications: 1, outcomes: 1 });
  });

  it("事实应用写入中途失败时工单、任务和 Outcome 全部回滚", async () => {
    const fixture = await createFixture();
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${schemaName}"."fail_work_fact_outcome_insert"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced outcome failure';
      END;
      $$;
      CREATE TRIGGER "fail_work_fact_outcome_insert"
      BEFORE INSERT ON "${schemaName}"."node_task_outcome"
      FOR EACH ROW EXECUTE FUNCTION "${schemaName}"."fail_work_fact_outcome_insert"();
    `);
    try {
      await expect(service.execute(fixture.command)).rejects.toBeTruthy();
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER "fail_work_fact_outcome_insert" ON "${schemaName}"."node_task_outcome";
        DROP FUNCTION "${schemaName}"."fail_work_fact_outcome_insert"();
      `);
    }

    await expectCounts(fixture, { applications: 0, outcomes: 0 });
    const workOrder = await prisma.workOrder.findUniqueOrThrow({
      where: { id: fixture.workOrderId },
    });
    const task = await prisma.nodeTask.findUniqueOrThrow({
      where: { id: fixture.taskId },
    });
    expect(workOrder).toMatchObject({ state: "ready", version: 0 });
    expect(task).toMatchObject({ state: "pending", version: 0 });
  });

  it.each(["draft", "failed", "cancelled"])(
    "required %s 工单不能被批量越过",
    async (workOrderState) => {
      const fixture = await createFixture({ workOrderState });

      const result = await service.execute(fixture.command);

      expect(result).toMatchObject({
        decision: "rejected",
        reasonCode: "WORK_ORDER_STATE_NOT_COMPLETABLE",
        outcomeId: null,
      });
      const workOrder = await prisma.workOrder.findUniqueOrThrow({
        where: { id: fixture.workOrderId },
      });
      expect(workOrder).toMatchObject({ state: workOrderState, version: 0 });
      await expectCounts(fixture, { applications: 1, outcomes: 0 });
    },
  );

  it("cancelled NodeTask 留下 rejected FactApplication 且不会复活", async () => {
    const fixture = await createFixture({ taskState: "cancelled" });

    await expect(service.execute(fixture.command)).resolves.toMatchObject({
      decision: "rejected",
      reasonCode: "NODE_TASK_CANCELLED",
      taskState: "cancelled",
      outcomeId: null,
    });
    const task = await prisma.nodeTask.findUniqueOrThrow({
      where: { id: fixture.taskId },
    });
    expect(task).toMatchObject({ state: "cancelled", version: 0 });
    await expectCounts(fixture, { applications: 1, outcomes: 0 });
  });

  it("租户、容器或节点错配不会留下任何写入", async () => {
    const fixture = await createFixture();

    await expect(
      service.execute({ ...fixture.command, tenantId: "other-tenant" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
    await expectCounts(fixture, { applications: 0, outcomes: 0 });
  });

  it("生命周期事实先到时不造任务，任务稍后创建后可按原事实重放", async () => {
    const fixture = await createFixture({ createTask: false });

    await expect(service.execute(fixture.command)).resolves.toMatchObject({
      decision: "no_op",
      reasonCode: "TASK_NOT_INITIALIZED",
      nodeTaskId: null,
    });
    const task = await createTask(fixture);
    fixture.taskId = task.taskId;
    fixture.workOrderId = task.workOrderId;

    await expect(service.execute(fixture.command)).resolves.toMatchObject({
      decision: "applied",
      taskState: "completed",
    });
    await expectCounts(fixture, { applications: 1, outcomes: 1 });
  });
});

describe("PrismaWorkExecutionRepository tenant-scoped reads", () => {
  it.each([
    { label: "带柜", containerless: false },
    { label: "无柜", containerless: true },
  ])("$label 任务与工单只在所属租户可见", async ({ containerless }) => {
    const fixture = await createFixture();
    if (containerless) {
      await prisma.nodeTask.update({
        where: { id: fixture.taskId },
        data: { containerId: null },
      });
    }
    const otherTenant = `tenant-${randomUUID()}`;

    const ownTask = await repository.findTaskInTenant({
      taskId: fixture.taskId,
      tenantId: fixture.tenantId,
    });
    expect(ownTask?.task).toMatchObject({
      id: fixture.taskId,
      tenantId: fixture.tenantId,
      containerId: containerless ? null : fixture.containerId,
    });
    expect(ownTask?.workOrders.map((workOrder) => workOrder.id)).toEqual([
      fixture.workOrderId,
    ]);
    await expect(
      repository.findWorkOrderInTenant({
        workOrderId: fixture.workOrderId,
        tenantId: fixture.tenantId,
      }),
    ).resolves.toMatchObject({
      id: fixture.workOrderId,
      nodeTaskId: fixture.taskId,
    });

    await expect(
      repository.findTaskInTenant({
        taskId: fixture.taskId,
        tenantId: otherTenant,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.findWorkOrderInTenant({
        workOrderId: fixture.workOrderId,
        tenantId: otherTenant,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.findTaskInTenant({
        taskId: randomUUID(),
        tenantId: fixture.tenantId,
      }),
    ).resolves.toBeNull();
  });
});

describe("PrismaWorkExecutionRepository claim/complete 写入范围与并发", () => {
  it.each(["claim", "complete"] as const)(
    "%s 错租户：工单、任务、outcome 与 ClientOperation 均零写入",
    async (action) => {
      const fixture = await createFixture();
      const before = await writeSnapshot(fixture.taskId);
      const otherTenant = `tenant-${randomUUID()}`;

      const result = await applyWrite(action, {
        tenantId: otherTenant,
        workOrderId: fixture.workOrderId,
        taskId: fixture.taskId,
      });

      expect(result).toEqual({ kind: "scope_mismatch" });
      await expect(writeSnapshot(fixture.taskId)).resolves.toEqual(before);
      await expect(
        operationCount(fixture.workOrderId, otherTenant),
      ).resolves.toBe(0);
    },
  );

  it.each(["claim", "complete"] as const)(
    "%s 错配 taskId：两张任务及其工单均零写入",
    async (action) => {
      const fixture = await createFixture();
      const other = await createFixture();
      await prisma.nodeTask.update({
        where: { id: other.taskId },
        data: { tenantId: fixture.tenantId },
      });
      const before = await Promise.all([
        writeSnapshot(fixture.taskId),
        writeSnapshot(other.taskId),
      ]);

      const result = await applyWrite(action, {
        tenantId: fixture.tenantId,
        workOrderId: fixture.workOrderId,
        taskId: other.taskId,
      });

      expect(result).toEqual({ kind: "scope_mismatch" });
      await expect(
        Promise.all([
          writeSnapshot(fixture.taskId),
          writeSnapshot(other.taskId),
        ]),
      ).resolves.toEqual(before);
      await expect(
        operationCount(fixture.workOrderId, fixture.tenantId),
      ).resolves.toBe(0);
    },
  );

  it("完成时任务版本落后：已执行的工单更新随事务回滚", async () => {
    const fixture = await createFixture();
    await prisma.nodeTask.update({
      where: { id: fixture.taskId },
      data: { version: { increment: 1 } },
    });
    const before = await writeSnapshot(fixture.taskId);

    const result = await applyWrite("complete", {
      tenantId: fixture.tenantId,
      workOrderId: fixture.workOrderId,
      taskId: fixture.taskId,
    });

    expect(result).toEqual({ kind: "version_conflict" });
    await expect(writeSnapshot(fixture.taskId)).resolves.toEqual(before);
    await expect(
      operationCount(fixture.workOrderId, fixture.tenantId),
    ).resolves.toBe(0);
  });

  it("同一工单以不同幂等键并发完成：只发生一次版本转换，另一方 applied=false", async () => {
    const fixture = await createFixture();

    const results = await Promise.all(
      ["key-a", "key-b"].map((idempotencyKey) =>
        completeService.execute({
          workOrderId: fixture.workOrderId,
          tenantId: fixture.tenantId,
          actorId: "operator-1",
          idempotencyKey,
        }),
      ),
    );

    expect(results.map((result) => result.applied).sort()).toEqual([
      false,
      true,
    ]);
    const snapshot = await writeSnapshot(fixture.taskId);
    expect(snapshot.workOrders).toEqual([
      { id: fixture.workOrderId, state: "completed", version: 1 },
    ]);
    expect(snapshot.task).toEqual({ state: "completed", version: 1 });
    expect(snapshot.outcomes).toBe(1);
    await expect(operationStates(fixture.workOrderId)).resolves.toEqual([
      "committed",
      "committed",
    ]);
  });

  it("同任务最后两张工单并发完成：两工单完成、任务 completed、outcome 仅一份", async () => {
    const fixture = await createFixture();
    const secondWorkOrderId = randomUUID();
    await prisma.workOrder.create({
      data: {
        id: secondWorkOrderId,
        nodeTaskId: fixture.taskId,
        workOrderDefinitionKey: "wo-container_unloading-2",
        state: "ready",
        applicability: "required",
        assignmentState: "unassigned",
      },
    });

    const results = await Promise.all(
      [fixture.workOrderId, secondWorkOrderId].map((workOrderId) =>
        completeService.execute({
          workOrderId,
          tenantId: fixture.tenantId,
          actorId: "operator-1",
        }),
      ),
    );

    expect(results.map((result) => result.applied)).toEqual([true, true]);
    expect(
      results.filter((result) => result.outcomeRecorded === true),
    ).toHaveLength(1);
    const snapshot = await writeSnapshot(fixture.taskId);
    expect(snapshot.workOrders.map(({ state }) => state)).toEqual([
      "completed",
      "completed",
    ]);
    expect(snapshot.task.state).toBe("completed");
    expect(snapshot.outcomes).toBe(1);
    const outcome = await prisma.nodeTaskOutcome.findUniqueOrThrow({
      where: { nodeTaskId: fixture.taskId },
    });
    expect([...(outcome.completedWorkOrderIds as string[])].sort()).toEqual(
      [fixture.workOrderId, secondWorkOrderId].sort(),
    );
    const operations = await Promise.all([
      operationStates(fixture.workOrderId),
      operationStates(secondWorkOrderId),
    ]);
    expect(operations).toEqual([["committed"], ["committed"]]);
  });
});

async function applyWrite(
  action: "claim" | "complete",
  scope: { tenantId: string; workOrderId: string; taskId: string },
) {
  const clientOperation = buildCommittedClientOperation({
    id: randomUUID(),
    tenantId: scope.tenantId,
    actorType: "user",
    actorId: "operator-1",
    actionCode: action === "claim" ? WORK_CLAIM_ACTION : WORK_COMPLETE_ACTION,
    targetId: scope.workOrderId,
    correlationId: randomUUID(),
    traceId: `trace-${randomUUID()}`,
    idempotencyKey: `key-${randomUUID()}`,
    requestHash: "a".repeat(64),
    resultRefs: [],
    now: new Date(),
  });
  if (action === "claim") {
    return repository.applyWorkOrderClaim({
      ...scope,
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: "operator-1",
      taskState: "in_progress",
      clientOperation,
    });
  }
  return repository.applyWorkOrderCompletion({
    ...scope,
    expectedWorkOrderVersion: 0,
    workOrderState: "completed",
    completedAt: new Date(),
    expectedTaskVersion: 0,
    taskState: "completed",
    outcome: null,
    clientOperation,
  });
}

async function writeSnapshot(taskId: string) {
  const [task, workOrders, outcomes] = await Promise.all([
    prisma.nodeTask.findUniqueOrThrow({
      where: { id: taskId },
      select: { state: true, version: true },
    }),
    prisma.workOrder.findMany({
      where: { nodeTaskId: taskId },
      select: { id: true, state: true, version: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.nodeTaskOutcome.count({ where: { nodeTaskId: taskId } }),
  ]);
  return { task, workOrders, outcomes };
}

function operationCount(workOrderId: string, tenantId: string) {
  return prisma.clientOperation.count({
    where: { targetId: workOrderId, tenantId },
  });
}

async function operationStates(workOrderId: string): Promise<string[]> {
  const rows = await prisma.clientOperation.findMany({
    where: { targetId: workOrderId },
    select: { commitState: true },
  });
  return rows.map((row) => row.commitState);
}

interface Fixture {
  tenantId: string;
  containerId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  canonicalEventId: string;
  taskId: string;
  workOrderId: string;
  command: ReconcileAppliedLifecycleFactCommand;
}

async function createFixture(options?: {
  createTask?: boolean;
  workOrderState?: string;
  taskState?: string;
}): Promise<Fixture> {
  const tenantId = `tenant-${randomUUID()}`;
  const containerId = randomUUID();
  const flowInstanceId = randomUUID();
  const nodeInstanceId = randomUUID();
  const canonicalEventId = randomUUID();
  const occurredAt = new Date("2026-09-21T08:00:00.000Z");
  await prisma.containerRecord.create({
    data: {
      id: containerId,
      tenantId,
      orderNumber: `ORDER-${randomUUID()}`,
      currentStatus: "in_transit",
    },
  });
  await prisma.flowInstance.create({
    data: {
      id: flowInstanceId,
      containerId,
      state: "active",
      currentNodeCode: "container_unloading",
    },
  });
  await prisma.nodeInstance.create({
    data: {
      id: nodeInstanceId,
      flowInstanceId,
      nodeCode: "container_unloading",
      state: "completed",
      completedAt: occurredAt,
    },
  });
  await prisma.canonicalEvent.create({
    data: {
      id: canonicalEventId,
      containerId,
      eventCode: "unloaded",
      occurredAt,
      evidenceRefs: ["evidence-1"],
      idempotencyKey: `event-${randomUUID()}`,
    },
  });
  await prisma.nodeEventApplication.create({
    data: {
      eventId: canonicalEventId,
      targetNodeInstanceId: nodeInstanceId,
      state: "applied",
      evaluatedAt: occurredAt,
      guardResults: [],
      appliedAt: occurredAt,
    },
  });

  const fixture: Fixture = {
    tenantId,
    containerId,
    flowInstanceId,
    nodeInstanceId,
    canonicalEventId,
    taskId: "",
    workOrderId: "",
    command: {
      tenantId,
      containerId,
      flowInstanceId,
      nodeInstanceId,
      nodeCode: "container_unloading",
      canonicalEventId,
      eventCode: "unloaded",
      businessFactType: "canonical_lifecycle_event",
      domainFactId: canonicalEventId,
      captureSource: "external_evidence",
      evidenceRefs: ["evidence-1"],
      occurredAt,
      receivedAt: new Date("2026-09-21T08:01:00.000Z"),
      actorOrServiceId: "integration-outbox-service",
      traceId: `trace-${randomUUID()}`,
      idempotencyKey: `outbox-${randomUUID()}`,
    },
  };
  if (options?.createTask !== false) {
    const task = await createTask(
      fixture,
      options?.workOrderState,
      options?.taskState,
    );
    fixture.taskId = task.taskId;
    fixture.workOrderId = task.workOrderId;
  }
  return fixture;
}

async function createTask(
  fixture: Pick<
    Fixture,
    "tenantId" | "containerId" | "flowInstanceId" | "nodeInstanceId"
  >,
  workOrderState = "ready",
  taskState = "pending",
): Promise<{ taskId: string; workOrderId: string }> {
  const taskId = randomUUID();
  const workOrderId = randomUUID();
  await prisma.nodeTask.create({
    data: {
      id: taskId,
      tenantId: fixture.tenantId,
      flowInstanceId: fixture.flowInstanceId,
      nodeInstanceId: fixture.nodeInstanceId,
      nodeCode: "container_unloading",
      containerId: fixture.containerId,
      taskDefinitionKey: "node-container_unloading",
      state: taskState,
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: {
        create: {
          id: workOrderId,
          workOrderDefinitionKey: "wo-container_unloading",
          state: workOrderState,
          applicability: "required",
          assignmentState: "unassigned",
        },
      },
    },
  });
  return { taskId, workOrderId };
}

async function expectCounts(
  fixture: Pick<Fixture, "workOrderId" | "taskId">,
  expected: { applications: number; outcomes: number },
): Promise<void> {
  const [applications, outcomes] = await Promise.all([
    prisma.workOrderFactApplication.count({
      where: { workOrderId: fixture.workOrderId },
    }),
    prisma.nodeTaskOutcome.count({ where: { nodeTaskId: fixture.taskId } }),
  ]);
  expect({ applications, outcomes }).toEqual(expected);
}

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
