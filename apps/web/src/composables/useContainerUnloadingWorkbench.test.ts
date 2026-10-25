import { describe, expect, it } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { selectUnloadingTask } from "./useContainerUnloadingWorkbench";

const task = (
  id: string,
  containerId: string | null = "c-1",
  nodeCode = "container_unloading",
): NodeTaskDetail => ({
  id,
  flowInstanceId: "flow",
  nodeInstanceId: id,
  nodeCode,
  containerId,
  taskDefinitionKey: "node-container_unloading",
  state: "pending",
  applicability: "required",
  readinessState: "ready",
  completionEligibility: "eligible",
  conditionFactRefs: [],
  workOrders: [],
  outcome: null,
  nextAction: null,
});

describe("selectUnloadingTask", () => {
  it("fails closed for explicit invalid, wrong-node, cross-container and null-container tasks", () => {
    const tasks = [
      task("u-1"),
      task("d-1", "c-1", "warehouse_delivery"),
      task("u-2", "c-2"),
      task("u-null", null),
    ];
    expect(selectUnloadingTask(tasks, "missing", "c-1")).toBeNull();
    expect(selectUnloadingTask(tasks, "d-1", "c-1")).toBeNull();
    expect(selectUnloadingTask(tasks, "u-2", "c-1")).toBeNull();
    expect(selectUnloadingTask(tasks, "u-null", "c-1")).toBeNull();
  });

  it("selects the first valid current-container task only when task id is omitted", () => {
    const tasks = [task("u-1"), task("u-2")];
    expect(selectUnloadingTask(tasks, "", "c-1")?.id).toBe("u-1");
  });
});
