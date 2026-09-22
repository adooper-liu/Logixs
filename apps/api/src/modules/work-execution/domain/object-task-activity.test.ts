import { describe, expect, it } from "vitest";
import type { NodeTaskWithWorkOrders } from "./work-execution.repository";
import {
  projectNextActions,
  projectTaskActivities,
  type WorkActivityOperation,
} from "./object-task-activity";

function task(
  taskOverrides: Partial<NodeTaskWithWorkOrders["task"]> = {},
  workOrderOverrides: Partial<
    NodeTaskWithWorkOrders["workOrders"][number]
  > = {},
): NodeTaskWithWorkOrders {
  return {
    task: {
      id: "task-1",
      tenantId: taskOverrides.tenantId ?? "tenant-1",
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
      version: taskOverrides.version ?? 0,
      createdAt: new Date("2026-09-18T01:00:00.000Z"),
      ...taskOverrides,
    },
    workOrders: [
      {
        id: "work-order-1",
        nodeTaskId: "task-1",
        workOrderDefinitionKey: "wo-customs-clearance",
        state: "ready",
        applicability: workOrderOverrides.applicability ?? "required",
        assignmentState: "unassigned",
        assigneeId: null,
        dueAt: new Date("2026-09-19T08:00:00.000Z"),
        completedAt: null,
        version: workOrderOverrides.version ?? 0,
        createdAt: new Date("2026-09-18T01:00:00.000Z"),
        ...workOrderOverrides,
      },
    ],
    outcome: null,
  };
}

describe("object task activity projection", () => {
  it("projects claim then complete from the existing work-order state", () => {
    expect(projectNextActions([task()])).toEqual([
      expect.objectContaining({
        actionCode: "work_execution.claim_work_order",
        assigneeId: null,
        dueAt: new Date("2026-09-19T08:00:00.000Z"),
      }),
    ]);
    expect(
      projectNextActions([
        task(
          { state: "in_progress" },
          {
            state: "in_progress",
            assignmentState: "assigned",
            assigneeId: "operator-1",
          },
        ),
      ]),
    ).toEqual([
      expect.objectContaining({
        actionCode: "work_execution.complete_work_order",
        assigneeId: "operator-1",
      }),
    ]);
  });

  it("does not invent actions for waiting, inapplicable, or completed tasks", () => {
    expect(
      projectNextActions([
        task({ readinessState: "waiting_conditions" }),
        task({ id: "task-2", applicability: "optional_not_applicable" }),
        task({ id: "task-3", state: "completed" }),
      ]),
    ).toEqual([]);
  });

  it("uses committed operation time and stable source ids", () => {
    const operations: WorkActivityOperation[] = [
      {
        id: "operation-1",
        actionCode: "work_execution.claim_work_order",
        targetId: "work-order-1",
        actorId: "operator-1",
        committedAt: new Date("2026-09-18T02:00:00.000Z"),
        recordedAt: new Date("2026-09-18T02:00:01.000Z"),
      },
    ];
    expect(projectTaskActivities([task()], operations)).toEqual([
      expect.objectContaining({ id: "task:task-1:created" }),
      expect.objectContaining({
        id: "operation:operation-1",
        activityCode: "work_order_claimed",
        occurredAt: new Date("2026-09-18T02:00:00.000Z"),
      }),
    ]);
  });
});
