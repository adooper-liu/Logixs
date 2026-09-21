import { effectScope, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCargoReadyWorkbench } from "./useCargoReadyWorkbench";

const getContainer = vi.fn();
const getContainerCargo = vi.fn();
const listContainers = vi.fn();
const listLifecycleNodes = vi.fn();
const listNodeTasks = vi.fn();
const listExternalWorkItems = vi.fn();
const getCargoReadyCompliance = vi.fn();

vi.mock("../api/containers", () => ({
  getContainer: (...args: unknown[]) => getContainer(...args),
  getContainerCargo: (...args: unknown[]) => getContainerCargo(...args),
  listContainers: (...args: unknown[]) => listContainers(...args),
}));
vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: (...args: unknown[]) => listLifecycleNodes(...args),
}));
vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
}));
vi.mock("../api/workItems", () => ({
  listExternalWorkItems: (...args: unknown[]) => listExternalWorkItems(...args),
}));
vi.mock("../api/cargoReadyCompliance", () => ({
  getCargoReadyCompliance: (...args: unknown[]) =>
    getCargoReadyCompliance(...args),
}));

describe("useCargoReadyWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      getContainer,
      getContainerCargo,
      listContainers,
      listLifecycleNodes,
      listNodeTasks,
      listExternalWorkItems,
      getCargoReadyCompliance,
    ]) {
      mock.mockReset();
    }
    getContainer.mockResolvedValue(container("c1"));
    getContainerCargo.mockResolvedValue({
      containerRecordId: "c1",
      allocationSetId: "a1",
      allocationSetVersion: 1,
      items: [],
    });
    listLifecycleNodes.mockResolvedValue({
      flow: {
        id: "f1",
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 1,
      },
      nodes: [node("cargo_ready")],
    });
    listNodeTasks.mockResolvedValue({
      items: [task("cargo_ready"), task("container_stuffing")],
    });
    listExternalWorkItems.mockResolvedValue({ items: [{ id: "work-1" }] });
    getCargoReadyCompliance.mockResolvedValue({ assessmentId: "assessment-1" });
    listContainers.mockResolvedValue({ items: [container("c1")] });
  });

  it("loads real cargo-ready projections and keeps node tasks separate", async () => {
    const containerId = ref("c1");
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyWorkbench(containerId))!;
    await flushPromises();

    expect(state.selectedContainer.value?.id).toBe("c1");
    expect(state.cargoReadyNode.value?.nodeCode).toBe("cargo_ready");
    expect(state.cargoReadyTasks.value.map((item) => item.nodeCode)).toEqual([
      "cargo_ready",
    ]);
    expect(state.remediationItems.value).toEqual([{ id: "work-1" }]);
    expect(state.allowedActions.value).toEqual([
      expect.objectContaining({
        taskId: "task-cargo_ready",
        actionCode: "claim",
      }),
    ]);
    expect(state.warnings.value).toEqual([]);
    scope.stop();
  });

  it("keeps successful projections when an auxiliary source fails", async () => {
    listExternalWorkItems.mockRejectedValue(new Error("network"));
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyWorkbench(ref("c1")))!;
    await flushPromises();

    expect(state.selectedContainer.value?.id).toBe("c1");
    expect(state.cargo.value?.allocationSetId).toBe("a1");
    expect(state.remediationItems.value).toEqual([]);
    expect(state.warnings.value).toEqual([
      { code: "remediation", message: "合规整改项暂时没能加载" },
    ]);
    scope.stop();
  });

  it("does not let an older container response overwrite a newer selection", async () => {
    let resolveFirst!: (value: ReturnType<typeof container>) => void;
    getContainer
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce(container("c2"));
    const containerId = ref("c1");
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyWorkbench(containerId))!;

    containerId.value = "c2";
    await flushPromises();
    resolveFirst(container("c1"));
    await flushPromises();

    expect(state.selectedContainer.value?.id).toBe("c2");
    scope.stop();
  });
});

function container(id: string) {
  return {
    id,
    orderNumber: `SO-${id}`,
    containerNumber: `MSCU-${id}`,
    currentStatus: "not_shipped" as const,
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function node(nodeCode: string) {
  return {
    nodeInstanceId: `node-${nodeCode}`,
    nodeCode,
    sequence: 1,
    state: "active",
    applicability: "required",
    completedAt: null,
    isCurrent: true,
  };
}

function task(nodeCode: string) {
  return {
    id: `task-${nodeCode}`,
    flowInstanceId: "flow-1",
    nodeInstanceId: `node-${nodeCode}`,
    nodeCode,
    containerId: "c1",
    taskDefinitionKey: `node-${nodeCode}`,
    state: "pending",
    applicability: "required" as const,
    readinessState: "ready" as const,
    completionEligibility: "eligible" as const,
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "claim",
      workOrderId: `work-order-${nodeCode}`,
      workOrderDefinitionKey: `work-order-${nodeCode}`,
      assignmentState: "unassigned",
      assigneeId: null,
      dueAt: null,
    },
  };
}
