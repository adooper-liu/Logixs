import { describe, expect, it, vi } from "vitest";
import { ListObjectTaskActivityService } from "./list-object-task-activity.service";

const bundle = {
  task: {
    id: "task-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "customs_clearance",
    containerId: "container-1",
    taskDefinitionKey: "node-customs-clearance",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "awaiting_evidence",
    conditionFactRefs: [],
    createdAt: new Date("2026-09-18T01:00:00.000Z"),
  },
  workOrders: [
    {
      id: "work-order-1",
      nodeTaskId: "task-1",
      workOrderDefinitionKey: "wo-customs-clearance",
      state: "ready",
      assignmentState: "unassigned",
      assigneeId: null,
      dueAt: null,
      completedAt: null,
      createdAt: new Date("2026-09-18T01:00:00.000Z"),
    },
  ],
  outcome: null,
};

describe("ListObjectTaskActivityService", () => {
  it("asserts tenant scope before projecting activity", async () => {
    const repository = {
      listTasksByContainer: vi.fn().mockResolvedValue([bundle]),
      listCommittedWorkActivityOperations: vi.fn().mockResolvedValue([]),
    };
    const scope = { execute: vi.fn().mockResolvedValue(undefined) };
    const service = new ListObjectTaskActivityService(
      repository as never,
      scope as never,
    );

    const result = await service.execute({
      tenantId: "tenant-1",
      containerId: "container-1",
      atOrBefore: new Date("2026-09-18T02:00:00.000Z"),
      take: 20,
    });
    expect(scope.execute.mock.invocationCallOrder[0]).toBeLessThan(
      repository.listTasksByContainer.mock.invocationCallOrder[0]!,
    );
    expect(result.nextActions[0]?.actionCode).toBe(
      "work_execution.claim_work_order",
    );
    expect(result.targets).toEqual([
      {
        containerId: "container-1",
        taskId: "task-1",
        workOrderId: "work-order-1",
      },
    ]);
  });

  it("rejects a work order outside the referenced task", async () => {
    const service = new ListObjectTaskActivityService(
      { findTaskById: vi.fn().mockResolvedValue(bundle) } as never,
      { execute: vi.fn().mockResolvedValue(undefined) } as never,
    );
    await expect(
      service.resolveTarget({
        tenantId: "tenant-1",
        containerId: "container-1",
        taskId: "task-1",
        workOrderId: "work-order-other",
      }),
    ).resolves.toBeNull();
  });
});
