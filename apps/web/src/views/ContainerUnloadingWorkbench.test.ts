import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContainerUnloadingWorkbench from "./ContainerUnloadingWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
const listDates = vi.fn();
const getInstruction = vi.fn();
const getReport = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
  getContainer: (...args: unknown[]) => getContainer(...args),
}));
vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: (...args: unknown[]) => listNodes(...args),
}));
vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listTasks(...args),
  claimWorkOrder: vi.fn(),
  completeWorkOrder: vi.fn(),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  listLifecycleDateFacts: (...args: unknown[]) => listDates(...args),
  recordLifecycleDateFact: vi.fn(),
}));
vi.mock("../api/warehouseDelivery", () => ({
  getWarehouseDeliveryInstruction: (...args: unknown[]) =>
    getInstruction(...args),
}));
vi.mock("../api/containerUnloading", () => ({
  getContainerUnloadingReport: (...args: unknown[]) => getReport(...args),
  appendContainerUnloadingReport: vi.fn(),
}));
vi.mock("../api/evidence", () => ({
  isEvidenceUuid: () => true,
  registerAndVerifyFloorEvidence: vi.fn(),
}));

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "picked_up",
  updatedAt: "2026-09-21T00:00:00Z",
};

describe("ContainerUnloadingWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      listNodes,
      listTasks,
      listDates,
      getInstruction,
      getReport,
    ])
      mock.mockReset();
    listContainers.mockResolvedValue({ items: [container] });
    getContainer.mockResolvedValue(container);
    listNodes.mockResolvedValue({ nodes: [] });
    listTasks.mockResolvedValue({ items: [task()] });
    listDates.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00Z",
    });
    getInstruction.mockResolvedValue(null);
    getReport.mockResolvedValue(null);
  });

  it("shows the operational sequence and separates partial, completed and empty confirmation", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get('[aria-label="卸柜任务列表"]').text()).toContain(
      "领取卸柜任务",
    );
    expect(wrapper.get('[aria-label="卸柜事实总览"]').text()).toContain(
      "先在送仓工作台锁定本柜本次目的仓",
    );
    expect(wrapper.get('[aria-label="卸货进度"]').text()).toContain(
      "先登记卸货开始",
    );
    expect(wrapper.get('[aria-label="卸柜操作区"]').text()).toContain(
      "部分卸货",
    );
    expect(wrapper.text()).toContain(
      "部分卸货不等于卸柜完成，卸柜完成也不等于下一站卸空确认",
    );
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/workspaces/unloading", component: ContainerUnloadingWorkbench },
    ],
  });
  await router.push("/workspaces/unloading?containerId=container-1");
  await router.isReady();
  const wrapper = mount(ContainerUnloadingWorkbench, {
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

function task() {
  return {
    id: "task-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "container_unloading",
    containerId: container.id,
    taskDefinitionKey: "node-container_unloading",
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
      workOrderDefinitionKey: "unloading",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
