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

  it("marks only tasks assigned to the session actor as mine", () => {
    const items = buildStuffingQueue({
      tasks: [
        task("pool", "container_stuffing", "2026-09-25T00:00:00.000Z"),
        task("mine", "container_stuffing", "2026-09-25T00:00:00.000Z", "a-1"),
        task("other", "container_stuffing", "2026-09-25T00:00:00.000Z", "a-2"),
      ],
      containers: [],
      actorId: "a-1",
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(
      filterStuffingQueue(items, "mine").map((item) => item.task.id),
    ).toEqual(["mine"]);
    expect(items.find((item) => item.task.id === "mine")?.responsibility).toBe(
      "我负责",
    );
  });

  it("fails closed without a session actor: nothing is mine, pool stays shared", () => {
    const items = buildStuffingQueue({
      tasks: [
        task("pool", "container_stuffing", "2026-09-25T00:00:00.000Z"),
        task(
          "assigned",
          "container_stuffing",
          "2026-09-25T00:00:00.000Z",
          "a-1",
        ),
      ],
      containers: [],
      actorId: null,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(filterStuffingQueue(items, "mine")).toEqual([]);
    expect(items.map((item) => item.responsibility).sort()).toEqual(
      ["已分配：a-1", "装箱共享池"].sort(),
    );
  });
});

function task(
  id: string,
  nodeCode: string,
  dueAt: string,
  assigneeId: string | null = null,
) {
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
      assignmentState: assigneeId ? "assigned" : "pool",
      assigneeId,
      dueAt,
    },
  };
}
