import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, shallowRef } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { usePickupWorkbench } from "./usePickupWorkbench";

const getContainer = vi.fn();
const listTasks = vi.fn();
vi.mock("../api/containers", () => ({
  getContainer: (...args: unknown[]) => getContainer(...args),
  listContainers: async () => ({ items: [] }),
}));
vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listTasks(...args),
}));
vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: async () => ({ nodes: [] }),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  listLifecycleDateFacts: async () => ({ items: [] }),
}));

const cleanups: (() => void)[] = [];

function task(
  id = "task-a",
  overrides: Partial<NodeTaskDetail> = {},
): NodeTaskDetail {
  return {
    id,
    flowInstanceId: "flow-a",
    nodeInstanceId: "node-a",
    nodeCode: "container_pickup",
    containerId: "container-a",
    taskDefinitionKey: "node-container_pickup",
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

async function setup(taskId = "task-a") {
  const containerId = shallowRef("container-a");
  const requestedTaskId = shallowRef(taskId);
  let state!: ReturnType<typeof usePickupWorkbench>;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = usePickupWorkbench(containerId, requestedTaskId);
        return () => null;
      },
    }),
  );
  cleanups.push(() => wrapper.unmount());
  await flushPromises();
  return { state, containerId, taskId: requestedTaskId };
}

describe("usePickupWorkbench exact selection", () => {
  beforeEach(() => {
    getContainer.mockReset().mockImplementation(async (id: string) => ({ id }));
    listTasks.mockReset().mockResolvedValue({ items: [task()] });
  });
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

  it("does not fall back when an explicit task does not exist", async () => {
    const { state } = await setup("missing");
    expect(state.selectedTask.value).toBeNull();
  });

  it.each([
    { nodeCode: "container_stuffing" },
    { containerId: "container-b" },
    { containerId: null },
  ])(
    "rejects an explicit task with an invalid identity: %j",
    async (override) => {
      listTasks.mockResolvedValue({
        items: [task("task-a", override), task("valid")],
      });
      const { state } = await setup();
      expect(state.selectedTask.value).toBeNull();
    },
  );

  it("defaults to the first legal task only when taskId is omitted", async () => {
    listTasks.mockResolvedValue({
      items: [
        task("wrong-node", { nodeCode: "container_stuffing" }),
        task("wrong-container", { containerId: "container-b" }),
        task("null-container", { containerId: null }),
        task("first-valid"),
        task("second-valid"),
      ],
    });
    const { state } = await setup("");
    expect(state.selectedTask.value?.id).toBe("first-valid");
  });

  it("selects the exact explicit task instead of the first legal task", async () => {
    listTasks.mockResolvedValue({ items: [task("first"), task("requested")] });
    const { state } = await setup("requested");
    expect(state.selectedTask.value?.id).toBe("requested");
  });

  it("recomputes same-container taskId changes without reloading or fallback", async () => {
    listTasks.mockResolvedValue({ items: [task("task-a"), task("task-b")] });
    const { state, taskId } = await setup();
    taskId.value = "task-b";
    expect(state.selectedTask.value?.id).toBe("task-b");
    taskId.value = "missing";
    expect(state.selectedTask.value).toBeNull();
    expect(getContainer).toHaveBeenCalledTimes(1);
  });

  it("withdraws the task immediately on a container change even if taskId is reused", async () => {
    const { state, containerId } = await setup();
    containerId.value = "container-b";
    expect(state.selectedTask.value).toBeNull();
    await flushPromises();
    expect(state.selectedTask.value).toBeNull();
  });

  it("withdraws A synchronously and ignores its late response after selecting B", async () => {
    const { state, containerId, taskId } = await setup();
    let releaseA!: (value: { items: NodeTaskDetail[] }) => void;
    const lateA = new Promise<{ items: NodeTaskDetail[] }>((resolve) => {
      releaseA = resolve;
    });
    listTasks.mockImplementation((input: { containerId?: string }) =>
      input.containerId === "container-a"
        ? lateA
        : Promise.resolve({
            items: [task("task-b", { containerId: "container-b" })],
          }),
    );
    const refreshingA = state.reload();
    containerId.value = "container-b";
    taskId.value = "task-b";
    expect(state.selectedTask.value).toBeNull();
    await flushPromises();
    expect(state.selectedTask.value?.id).toBe("task-b");
    releaseA({ items: [task()] });
    await refreshingA;
    expect(state.selectedTask.value?.id).toBe("task-b");
    expect(state.selectedContainer.value?.id).toBe("container-b");
  });
});
