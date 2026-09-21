import { describe, expect, it } from "vitest";
import { buildDispatchQueue } from "./dispatchWorkbench";

describe("dispatch workbench projection", () => {
  it("keeps shipment dispatch work and prioritizes overdue tasks", () => {
    const items = buildDispatchQueue({
      tasks: [
        task("future", "shipment_dispatch", "2026-09-25T00:00:00Z"),
        task("other", "origin_departure", null),
        task("late", "shipment_dispatch", "2026-09-20T00:00:00Z"),
      ],
      containers: [],
      now: new Date("2026-09-21T00:00:00Z"),
    });
    expect(items.map((item) => item.task.id)).toEqual(["late", "future"]);
    expect(items[0]?.urgency).toBe("overdue");
  });
});

function task(id: string, nodeCode: string, dueAt: string | null) {
  return {
    id,
    flowInstanceId: "flow-1",
    nodeInstanceId: `node-${id}`,
    nodeCode,
    containerId: null,
    taskDefinitionKey: `task-${id}`,
    state: "pending",
    applicability: "required" as const,
    readinessState: "ready" as const,
    completionEligibility: "eligible" as const,
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: `work-${id}`,
      workOrderDefinitionKey: "dispatch",
      assignmentState: "pool",
      assigneeId: null,
      dueAt,
    },
  };
}
