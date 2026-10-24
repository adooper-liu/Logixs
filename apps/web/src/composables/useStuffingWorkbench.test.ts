import { describe, expect, it, vi } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { collectCursorPages, selectStuffingTask } from "./useStuffingWorkbench";

const containerId = "44444444-4444-4444-8444-444444444444";

function task(
  id: string,
  overrides: Partial<NodeTaskDetail> = {},
): NodeTaskDetail {
  return {
    id,
    flowInstanceId: `flow-${id}`,
    nodeInstanceId: `node-${id}`,
    nodeCode: "container_stuffing",
    containerId,
    taskDefinitionKey: "node-container_stuffing",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: null,
    ...overrides,
  };
}

describe("collectCursorPages", () => {
  it("reads every cursor page in order", async () => {
    const load = vi.fn(async (cursor?: string) =>
      cursor
        ? {
            items: ["third"],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }
        : {
            items: ["first", "second"],
            pageInfo: { hasNextPage: true, nextCursor: "cursor-2" },
          },
    );

    await expect(collectCursorPages(load)).resolves.toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(load).toHaveBeenNthCalledWith(1, undefined);
    expect(load).toHaveBeenNthCalledWith(2, "cursor-2");
  });

  it.each([{ nextCursor: null }, { nextCursor: "same" }])(
    "fails closed on an invalid cursor chain",
    async ({ nextCursor }) => {
      const load = vi.fn(async (cursor?: string) => ({
        items: [cursor ?? "first"],
        pageInfo: {
          hasNextPage: true,
          nextCursor: cursor ? "same" : nextCursor,
        },
      }));

      await expect(collectCursorPages(load)).rejects.toThrow(
        "PAGINATION_CURSOR_INVALID",
      );
    },
  );
});

describe("selectStuffingTask", () => {
  it("fails closed when an explicit task id is missing", () => {
    expect(
      selectStuffingTask([task("task-a")], "missing-task", containerId),
    ).toBeNull();
  });

  it("defaults only when the URL omits taskId", () => {
    const expected = task("task-a");
    expect(selectStuffingTask([expected], "", containerId)).toBe(expected);
  });

  it.each([
    task("wrong-node", { nodeCode: "container_pickup" }),
    task("wrong-container", {
      containerId: "99999999-9999-4999-8999-999999999999",
    }),
  ])("rejects a task outside the exact stuffing container", (candidate) => {
    expect(
      selectStuffingTask([candidate], candidate.id, containerId),
    ).toBeNull();
    expect(selectStuffingTask([candidate], "", containerId)).toBeNull();
  });
});
