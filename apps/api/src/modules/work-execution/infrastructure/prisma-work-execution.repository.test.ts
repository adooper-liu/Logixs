import { describe, expect, it, vi } from "vitest";
import { PrismaWorkExecutionRepository } from "./prisma-work-execution.repository";

describe("PrismaWorkExecutionRepository.upsertTaskWithRequiredWorkOrder", () => {
  it("先行事实把既有计划任务提升为可执行且具备完成资格", async () => {
    const existing = {
      id: "task-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "customs_clearance",
      containerId: "container-1",
      taskDefinitionKey: "node-customs_clearance",
      state: "pending",
      applicability: "required",
      readinessState: "waiting_conditions",
      completionEligibility: "awaiting_evidence",
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
      assignmentState: "unassigned",
      assigneeId: null,
      completedAt: null,
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
      data: { state: "ready" },
    });
    expect(result.task.completionEligibility).toBe("eligible");
  });
});
