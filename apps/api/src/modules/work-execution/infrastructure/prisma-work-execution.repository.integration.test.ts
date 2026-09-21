import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../../generated/prisma";
import type { ReconcileAppliedLifecycleFactCommand } from "../reconcile-applied-lifecycle-fact.port";
import { ReconcileAppliedLifecycleFactService } from "../application/reconcile-applied-lifecycle-fact.service";
import { PrismaWorkExecutionRepository } from "./prisma-work-execution.repository";

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

beforeAll(async () => {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl },
      { schema: schemaName },
    ),
  });
  await prisma.$connect();
  repository = new PrismaWorkExecutionRepository(prisma as never);
  service = new ReconcileAppliedLifecycleFactService(repository);
});

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: withSchema(BASE_DATABASE_URL, "public"),
      },
      { schema: "public" },
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
