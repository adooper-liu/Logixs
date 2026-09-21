import { describe, expect, it } from "vitest";
import { buildStuffingQueue, filterStuffingQueue } from "./stuffingWorkbench";

describe("stuffing workbench projection", () => {
  it("keeps only stuffing tasks and sorts overdue work first", () => {
    const items = buildStuffingQueue({
      tasks: [
        task("future", "container_stuffing", "2026-09-25T00:00:00.000Z"),
        task("other", "shipment_dispatch", "2026-09-20T00:00:00.000Z"),
        task("overdue", "container_stuffing", "2026-09-20T00:00:00.000Z"),
      ],
      containers: [],
      actorId: "dev-operator",
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(items.map((item) => item.task.id)).toEqual(["overdue", "future"]);
    expect(items[0]?.urgencyLabel).toBe("已逾期");
    expect(filterStuffingQueue(items, "executable")).toHaveLength(2);
  });
});

function task(id: string, nodeCode: string, dueAt: string) {
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
      workOrderDefinitionKey: "stuffing",
      assignmentState: "pool",
      assigneeId: null,
      dueAt,
    },
  };
}
