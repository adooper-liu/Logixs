import { describe, expect, it, vi } from "vitest";
import { buildCommittedClientOperation } from "../domain/client-operation";
import { PrismaWorkExecutionRepository } from "./prisma-work-execution.repository";

describe("PrismaWorkExecutionRepository.upsertTaskWithRequiredWorkOrder", () => {
  it("先行事实把既有计划任务提升为可执行且具备完成资格", async () => {
    const existing = {
      id: "task-1",
      tenantId: "tenant-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "customs_clearance",
      containerId: "container-1",
      taskDefinitionKey: "node-customs_clearance",
      state: "pending",
      applicability: "required",
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
      version: 0,
      conditionFactRefs: [],
      createdAt: new Date("2026-09-17T00:00:00Z"),
      workOrders: [],
      outcome: null,
    };
    const updated = {
      ...existing,
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-1"],
    };
    const workOrder = {
      id: "work-1",
      nodeTaskId: "task-1",
      workOrderDefinitionKey: "wo-customs_clearance",
      state: "ready",
      applicability: "required",
      assignmentState: "unassigned",
      assigneeId: null,
      completedAt: null,
      version: 0,
    };
    const tx = {
      nodeTask: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
      },
      workOrder: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([workOrder]),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaWorkExecutionRepository(prisma as never);

    const result = await repository.upsertTaskWithRequiredWorkOrder({
      tenantId: "tenant-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "customs_clearance",
      containerId: "container-1",
      taskDefinitionKey: "node-customs_clearance",
      workOrderDefinitionKey: "wo-customs_clearance",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-1"],
    });

    expect(tx.nodeTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: ["fact-1"],
      }),
    });
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith({
      where: { nodeTaskId: "task-1", state: "draft" },
      data: { state: "ready", version: { increment: 1 } },
    });
    expect(result.task.completionEligibility).toBe("eligible");
  });

  it("按任务自身 tenantId 查询，不再经可空 containerId 间接判断租户", async () => {
    const prisma = {
      nodeTask: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new PrismaWorkExecutionRepository(prisma as never);

    await expect(
      repository.listTasksByTenant({ tenantId: "tenant-1", take: 51 }),
    ).resolves.toEqual([]);
    expect(prisma.nodeTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 51,
      }),
    );
  });

  it("任务详情按 taskId + tenantId 查询，不先加载他租户聚合", async () => {
    const prisma = {
      nodeTask: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaWorkExecutionRepository(prisma as never);

    await expect(
      repository.findTaskInTenant({ taskId: "task-1", tenantId: "tenant-1" }),
    ).resolves.toBeNull();
    expect(prisma.nodeTask.findUnique).toHaveBeenCalledWith({
      where: { id: "task-1", tenantId: "tenant-1" },
      include: { workOrders: true, outcome: true },
    });
  });

  it("工单经所属任务限定租户查询", async () => {
    const prisma = {
      workOrder: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const repository = new PrismaWorkExecutionRepository(prisma as never);

    await expect(
      repository.findWorkOrderInTenant({
        workOrderId: "wo-1",
        tenantId: "tenant-1",
      }),
    ).resolves.toBeNull();
    expect(prisma.workOrder.findFirst).toHaveBeenCalledWith({
      where: { id: "wo-1", nodeTask: { tenantId: "tenant-1" } },
    });
  });
});

const SCOPE = {
  id: "wo-1",
  nodeTaskId: "task-1",
  nodeTask: { tenantId: "tenant-1" },
};

function writeTx(counts: {
  workOrderUpdated?: number;
  workOrderInScope?: number;
  taskUpdated?: number;
  taskInScope?: number;
}) {
  const tx = {
    workOrder: {
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: counts.workOrderUpdated ?? 1 }),
      count: vi.fn().mockResolvedValue(counts.workOrderInScope ?? 1),
    },
    nodeTask: {
      updateMany: vi.fn().mockResolvedValue({ count: counts.taskUpdated ?? 1 }),
      count: vi.fn().mockResolvedValue(counts.taskInScope ?? 1),
    },
    nodeTaskOutcome: { create: vi.fn().mockResolvedValue({}) },
    clientOperation: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return {
    tx,
    repository: new PrismaWorkExecutionRepository(prisma as never),
  };
}

function operation() {
  return buildCommittedClientOperation({
    id: "op-1",
    tenantId: "tenant-1",
    actorType: "user",
    actorId: "user-1",
    targetId: "wo-1",
    correlationId: "corr-1",
    traceId: "trace-1",
    idempotencyKey: "work-order:wo-1:complete",
    requestHash: "a".repeat(64),
    resultRefs: [],
    now: new Date("2026-09-30T00:00:00Z"),
  });
}

function claimInput() {
  return {
    tenantId: "tenant-1",
    workOrderId: "wo-1",
    workOrderState: "in_progress" as const,
    assignmentState: "assigned" as const,
    assigneeId: "user-1",
    taskId: "task-1",
    taskState: "in_progress" as const,
    clientOperation: operation(),
  };
}

function completionInput() {
  return {
    tenantId: "tenant-1",
    workOrderId: "wo-1",
    expectedWorkOrderVersion: 3,
    workOrderState: "completed" as const,
    completedAt: new Date("2026-09-30T00:00:00Z"),
    taskId: "task-1",
    expectedTaskVersion: 5,
    taskState: "completed" as const,
    outcome: null,
    clientOperation: operation(),
  };
}

describe("PrismaWorkExecutionRepository.applyWorkOrderClaim", () => {
  it("工单更新同时限定工单、所属任务与任务租户，任务更新限定租户", async () => {
    const { tx, repository } = writeTx({});

    await expect(repository.applyWorkOrderClaim(claimInput())).resolves.toEqual(
      { kind: "applied" },
    );
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ...SCOPE,
          assignmentState: { in: ["unassigned", "pool"] },
          state: { in: ["ready", "reopened", "in_progress"] },
        }),
      }),
    );
    expect(tx.nodeTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", tenantId: "tenant-1" },
      }),
    );
    expect(tx.clientOperation.create).toHaveBeenCalledTimes(1);
  });

  it("工单不在租户父链内报 scope_mismatch，不写任务与回执", async () => {
    const { tx, repository } = writeTx({
      workOrderUpdated: 0,
      workOrderInScope: 0,
    });

    await expect(repository.applyWorkOrderClaim(claimInput())).resolves.toEqual(
      { kind: "scope_mismatch" },
    );
    expect(tx.workOrder.count).toHaveBeenCalledWith({ where: SCOPE });
    expect(tx.nodeTask.updateMany).not.toHaveBeenCalled();
    expect(tx.clientOperation.create).not.toHaveBeenCalled();
  });

  it("工单在范围内但状态条件不满足报 state_conflict", async () => {
    const { tx, repository } = writeTx({ workOrderUpdated: 0 });

    await expect(repository.applyWorkOrderClaim(claimInput())).resolves.toEqual(
      { kind: "state_conflict" },
    );
    expect(tx.nodeTask.updateMany).not.toHaveBeenCalled();
    expect(tx.clientOperation.create).not.toHaveBeenCalled();
  });

  it("任务租户不命中时抛出回滚并报 scope_mismatch，不写回执", async () => {
    const { tx, repository } = writeTx({ taskUpdated: 0 });

    await expect(repository.applyWorkOrderClaim(claimInput())).resolves.toEqual(
      { kind: "scope_mismatch" },
    );
    expect(tx.clientOperation.create).not.toHaveBeenCalled();
  });
});

describe("PrismaWorkExecutionRepository.applyWorkOrderCompletion", () => {
  it("工单与任务更新均以租户父链和已读版本为条件", async () => {
    const { tx, repository } = writeTx({});

    await expect(
      repository.applyWorkOrderCompletion(completionInput()),
    ).resolves.toEqual({ kind: "applied" });
    expect(tx.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...SCOPE, version: 3 } }),
    );
    expect(tx.nodeTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", tenantId: "tenant-1", version: 5 },
      }),
    );
    expect(tx.clientOperation.create).toHaveBeenCalledTimes(1);
  });

  it("工单版本落后报 version_conflict，不写任务、outcome 与回执", async () => {
    const { tx, repository } = writeTx({ workOrderUpdated: 0 });

    await expect(
      repository.applyWorkOrderCompletion(completionInput()),
    ).resolves.toEqual({ kind: "version_conflict" });
    expect(tx.nodeTask.updateMany).not.toHaveBeenCalled();
    expect(tx.nodeTaskOutcome.create).not.toHaveBeenCalled();
    expect(tx.clientOperation.create).not.toHaveBeenCalled();
  });

  it("工单不在租户父链内报 scope_mismatch", async () => {
    const { tx, repository } = writeTx({
      workOrderUpdated: 0,
      workOrderInScope: 0,
    });

    await expect(
      repository.applyWorkOrderCompletion(completionInput()),
    ).resolves.toEqual({ kind: "scope_mismatch" });
    expect(tx.nodeTask.updateMany).not.toHaveBeenCalled();
  });

  it("任务版本落后报 version_conflict，任务租户不命中报 scope_mismatch", async () => {
    const stale = writeTx({ taskUpdated: 0, taskInScope: 1 });
    await expect(
      stale.repository.applyWorkOrderCompletion(completionInput()),
    ).resolves.toEqual({ kind: "version_conflict" });
    expect(stale.tx.clientOperation.create).not.toHaveBeenCalled();

    const foreign = writeTx({ taskUpdated: 0, taskInScope: 0 });
    await expect(
      foreign.repository.applyWorkOrderCompletion(completionInput()),
    ).resolves.toEqual({ kind: "scope_mismatch" });
    expect(foreign.tx.nodeTask.count).toHaveBeenCalledWith({
      where: { id: "task-1", tenantId: "tenant-1" },
    });
    expect(foreign.tx.nodeTaskOutcome.create).not.toHaveBeenCalled();
    expect(foreign.tx.clientOperation.create).not.toHaveBeenCalled();
  });
});
