import { describe, expect, it } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { buildPickupQueue } from "./pickupWorkbench";

describe("pickup workbench projection", () => {
  it("keeps pickup work and sorts overdue tasks first", () => {
    const items = buildPickupQueue({
      tasks: [
        task("future", "container_pickup", "2026-09-25T00:00:00Z"),
        task("other", "warehouse_delivery", null),
        task("late", "container_pickup", "2026-09-20T00:00:00Z"),
      ],
      containers: [],
      now: new Date("2026-09-21T00:00:00Z"),
    });
    expect(items.map((item) => item.task.id)).toEqual(["late", "future"]);
    expect(items[0]?.actionLabel).toBe("领取提柜任务");
  });
});

function task(
  id: string,
  nodeCode: string,
  dueAt: string | null,
): NodeTaskDetail {
  return {
    id,
    flowInstanceId: "flow-1",
    nodeInstanceId: `node-${id}`,
    nodeCode,
    containerId: null,
    taskDefinitionKey: `node-${nodeCode}`,
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: `work-${id}`,
      workOrderDefinitionKey: "pickup",
      assignmentState: "pool",
      assigneeId: null,
      dueAt,
    },
  };
}
