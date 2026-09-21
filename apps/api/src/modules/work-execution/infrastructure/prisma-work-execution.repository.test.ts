import { describe, expect, it, vi } from "vitest";
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
});
