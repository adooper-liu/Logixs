import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StuffingWorkbench from "./StuffingWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const getContainerCargo = vi.fn();
const listLifecycleNodes = vi.fn();
const listNodeTasks = vi.fn();
const getSnapshot = vi.fn();
const listDateFacts = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
  getContainer: (...args: unknown[]) => getContainer(...args),
  getContainerCargo: (...args: unknown[]) => getContainerCargo(...args),
}));
vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: (...args: unknown[]) => listLifecycleNodes(...args),
}));
vi.mock("../api/nodeTasks", () => ({
  DEV_OPERATOR_ID: "dev-operator",
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
  claimWorkOrder: vi.fn(),
  completeWorkOrder: vi.fn(),
}));
vi.mock("../api/containerStuffing", () => ({
  getContainerStuffingSnapshot: (...args: unknown[]) => getSnapshot(...args),
  replaceContainerStuffingSnapshot: vi.fn(),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  listLifecycleDateFacts: (...args: unknown[]) => listDateFacts(...args),
  recordLifecycleDateFact: vi.fn(),
}));
vi.mock("../api/evidence", () => ({
  isEvidenceUuid: () => true,
  registerAndVerifyFloorEvidence: vi.fn(),
}));

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "not_shipped",
  updatedAt: "2026-09-21T00:00:00.000Z",
};

describe("StuffingWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      getContainerCargo,
      listLifecycleNodes,
      listNodeTasks,
      getSnapshot,
      listDateFacts,
    ])
      mock.mockReset();
    listContainers.mockResolvedValue({ items: [container] });
    getContainer.mockResolvedValue(container);
    getContainerCargo.mockResolvedValue({
      containerRecordId: container.id,
      allocationSetId: "allocation-1",
      allocationSetVersion: 2,
      items: [
        {
          replenishmentOrderLineId: "line-1",
          productSkuId: "sku-1",
          productNumber: "833-066V00BK",
          allocatedQuantity: "50",
          quantityUnit: "carton",
        },
      ],
    });
    listLifecycleNodes.mockResolvedValue({
      flow: { id: "flow-1" },
      nodes: [
        {
          nodeInstanceId: "node-1",
          nodeCode: "container_stuffing",
          sequence: 2,
          state: "active",
          applicability: "required",
          completedAt: null,
          blockedReasonRefs: [],
          isCurrent: true,
          times: { plannedAt: null, estimatedAt: null, actualAt: null },
        },
      ],
    });
    listNodeTasks.mockResolvedValue({ items: [nodeTask()] });
    getSnapshot.mockResolvedValue(null);
    listDateFacts.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00.000Z",
    });
  });

  it("shows the operator cargo scope, missing snapshot and allowed task action", async () => {
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("833-066V00BK");
    expect(wrapper.text()).toContain("50 carton");
    expect(wrapper.text()).toContain("待记录装箱结果");
    expect(wrapper.get('[aria-label="装箱结果表单"]').text()).toContain(
      "保存装箱记录",
    );
    expect(wrapper.get('[aria-label="实际装箱时间表单"]').text()).toContain(
      "先保存当前装载版本",
    );
    expect(wrapper.get('[aria-label="装箱任务列表"]').text()).toContain(
      "完成装箱确认",
    );
    expect(wrapper.text()).not.toContain("node-container_stuffing");
  });

  it("keeps successful cargo data visible when date projection fails", async () => {
    listDateFacts.mockRejectedValue(new Error("network"));
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("833-066V00BK");
    expect(wrapper.text()).toContain("装箱日期暂时没能加载");
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/stuffing", component: StuffingWorkbench }],
  });
  await router.push("/workspaces/stuffing?containerId=container-1");
  await router.isReady();
  const wrapper = mount(StuffingWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title"],
          template: "<header><h1>{{ title }}</h1></header>",
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function nodeTask() {
  return {
    id: "task-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "container_stuffing",
    containerId: container.id,
    taskDefinitionKey: "node-container_stuffing",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: "work-1",
      workOrderDefinitionKey: "stuffing",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
