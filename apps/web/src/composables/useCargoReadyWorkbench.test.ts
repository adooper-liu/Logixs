import { flushPromises } from "@vue/test-utils";
import { effectScope, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCargoReadyWorkbench } from "./useCargoReadyWorkbench";

const listReplenishmentOrders = vi.fn();
const listLifecycleNodes = vi.fn();
const listNodeTasks = vi.fn();
const listExternalWorkItems = vi.fn();
const getCargoReadyCompliance = vi.fn();

vi.mock("../api/replenishmentOrders", () => ({
  listReplenishmentOrders: (...args: unknown[]) =>
    listReplenishmentOrders(...args),
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
      listReplenishmentOrders,
      listLifecycleNodes,
      listNodeTasks,
      listExternalWorkItems,
      getCargoReadyCompliance,
    ]) {
      mock.mockReset();
    }
    listReplenishmentOrders.mockResolvedValue({ items: [order("o1", "c1")] });
    listLifecycleNodes.mockResolvedValue({ flow: null, nodes: [] });
    listNodeTasks.mockResolvedValue({ items: [task("c1")] });
    listExternalWorkItems.mockResolvedValue({ items: [{ id: "work-1" }] });
    getCargoReadyCompliance.mockResolvedValue(assessment("c1"));
  });

  it("loads orders first and keeps node tasks separate from remediation", async () => {
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyWorkbench(ref("o1"), ref("")))!;

    await state.loadOrders();
    await flushPromises();

    expect(state.selectedOrder.value?.id).toBe("o1");
    expect(state.cargoReadyTasks.value.map((item) => item.containerId)).toEqual(
      ["c1"],
    );
    expect(state.remediationItems.value).toEqual([{ id: "work-1" }]);
    expect(state.skuViews.value[0]?.line.productNumber).toBe("311-013GY");
    expect(state.warnings.value).toEqual([]);
    scope.stop();
  });

  it("keeps the order usable when an auxiliary source fails", async () => {
    listExternalWorkItems.mockRejectedValue(new Error("network"));
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyWorkbench(ref("o1"), ref("")))!;

    await state.loadOrders();
    await flushPromises();

    expect(state.selectedOrder.value?.orderNumber).toBe("26DSC01812");
    expect(state.skuViews.value).toHaveLength(1);
    expect(state.remediationItems.value).toEqual([]);
    expect(state.warnings.value).toEqual([
      {
        code: "remediation",
        message: "合规整改项暂时没能加载",
      },
    ]);
    scope.stop();
  });

  it("does not request container projections for an unallocated order", async () => {
    listReplenishmentOrders.mockResolvedValue({ items: [order("o1", null)] });
    const scope = effectScope();
    const state = scope.run(() => useCargoReadyWorkbench(ref("o1"), ref("")))!;

    await state.loadOrders();
    await flushPromises();

    expect(state.selectedOrder.value?.relatedContainers).toEqual([]);
    expect(state.skuViews.value[0]?.line.productNumber).toBe("311-013GY");
    expect(listLifecycleNodes).not.toHaveBeenCalled();
    expect(listNodeTasks).not.toHaveBeenCalled();
    expect(getCargoReadyCompliance).not.toHaveBeenCalled();
    scope.stop();
  });
});

function order(id: string, containerId: string | null) {
  return {
    id,
    orderNumber: "26DSC01812",
    updatedAt: "2026-09-21T00:00:00.000Z",
    workReason: {
      code: "ready_for_container_review",
      label: "完成备货确认",
      detail: "物料事实齐全，已完成装柜分配",
      responsibility: "mine",
    },
    nextAction: {
      code: "work_execution.continue_cargo_ready",
      label: "继续备货确认",
    },
    relatedContainers: containerId
      ? [{ id: containerId, containerNumber: "HMMU4956442" }]
      : [],
    lines: [
      {
        id: "line-1",
        productSkuId: "sku-1",
        productNumber: "311-013GY",
        shippedQuantity: "20",
        quantityUnit: "piece",
        allocatedQuantity: containerId ? "20" : "0",
        unallocatedQuantity: containerId ? "0" : "20",
        allocations: containerId
          ? [
              {
                containerId,
                containerNumber: "HMMU4956442",
                allocatedQuantity: "20",
                quantityUnit: "piece",
              },
            ]
          : [],
        profile: null,
        gaps: [
          {
            code: "product_profile_missing",
            label: "物料属性档案尚未建立",
          },
        ],
      },
    ],
  };
}

function task(containerId: string) {
  return {
    id: `task-${containerId}`,
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "cargo_ready",
    containerId,
    taskDefinitionKey: "node-cargo_ready",
    state: "pending",
    applicability: "required" as const,
    readinessState: "ready" as const,
    completionEligibility: "eligible" as const,
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: null,
  };
}

function assessment(containerId: string) {
  return {
    assessmentId: `assessment-${containerId}`,
    containerRecordId: containerId,
    version: 1,
    state: "ready_for_decision",
    jurisdictionCountryCode: "ES",
    assessmentDate: "2026-09-21",
    allocationSetId: "allocation-1",
    allocationSetVersion: 1,
    items: [
      {
        replenishmentOrderLineId: "line-1",
        productSkuId: "sku-1",
        productNumber: "311-013GY",
        complianceProfileId: null,
        complianceProfileVersion: null,
      },
    ],
    findings: [],
    applicableRules: [],
    evidenceRefs: [],
    actorId: "reviewer",
    reasonCode: "initial",
    currentDecision: null,
    createdAt: "2026-09-21T00:00:00.000Z",
  };
}
