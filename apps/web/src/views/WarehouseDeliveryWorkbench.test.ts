import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WarehouseDeliveryWorkbench from "./WarehouseDeliveryWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
const listDates = vi.fn();
const getInstruction = vi.fn();

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
  replaceWarehouseDeliveryInstruction: vi.fn(),
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

describe("WarehouseDeliveryWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      listNodes,
      listTasks,
      listDates,
      getInstruction,
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
  });

  it("shows the real delivery sequence and keeps work completion separate from passage", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get('[aria-label="送仓任务列表"]').text()).toContain(
      "领取送仓任务",
    );
    expect(wrapper.get('[aria-label="送仓事实总览"]').text()).toContain(
      "先锁定本柜本次目的仓",
    );
    expect(wrapper.get('[aria-label="目的仓指令"]').text()).toContain(
      "锁定目的仓",
    );
    expect(wrapper.get('[aria-label="送仓操作区"]').text()).toContain(
      "提交实际送仓复核",
    );
    expect(wrapper.text()).toContain(
      "工单完成只代表岗位作业完成；只有经采信且目的仓匹配的实际送仓事实才代表货柜到仓",
    );
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/workspaces/delivery", component: WarehouseDeliveryWorkbench },
    ],
  });
  await router.push("/workspaces/delivery?containerId=container-1");
  await router.isReady();
  const wrapper = mount(WarehouseDeliveryWorkbench, {
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
    nodeCode: "warehouse_delivery",
    containerId: container.id,
    taskDefinitionKey: "node-warehouse_delivery",
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
      workOrderDefinitionKey: "delivery",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
