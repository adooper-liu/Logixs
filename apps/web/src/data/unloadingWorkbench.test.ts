import { describe, expect, it } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { buildUnloadingQueue } from "./unloadingWorkbench";

describe("unloading workbench projection", () => {
  it("keeps unloading tasks and sorts overdue work first", () => {
    const items = buildUnloadingQueue({
      tasks: [
        task("future", "container_unloading", "2026-09-25T00:00:00Z"),
        task("other", "container_unstuffing", null),
        task("late", "container_unloading", "2026-09-20T00:00:00Z"),
      ],
      containers: [],
      now: new Date("2026-09-21T00:00:00Z"),
    });
    expect(items.map((item) => item.task.id)).toEqual(["late", "future"]);
    expect(items[0]?.actionLabel).toBe("领取卸柜任务");
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
      workOrderDefinitionKey: "unloading",
      assignmentState: "pool",
      assigneeId: null,
      dueAt,
    },
  };
}
