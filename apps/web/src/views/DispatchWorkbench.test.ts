import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DispatchWorkbench from "./DispatchWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
const getStuffing = vi.fn();
const getDispatch = vi.fn();
const listDates = vi.fn();

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
vi.mock("../api/containerStuffing", () => ({
  getContainerStuffingSnapshot: (...args: unknown[]) => getStuffing(...args),
}));
vi.mock("../api/containerDispatch", () => ({
  getContainerDispatchSnapshot: (...args: unknown[]) => getDispatch(...args),
  replaceContainerDispatchSnapshot: vi.fn(),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  listLifecycleDateFacts: (...args: unknown[]) => listDates(...args),
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
  updatedAt: "2026-09-21T00:00:00Z",
};

describe("DispatchWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      listNodes,
      listTasks,
      getStuffing,
      getDispatch,
      listDates,
    ])
      mock.mockReset();
    listContainers.mockResolvedValue({ items: [container] });
    getContainer.mockResolvedValue(container);
    listNodes.mockResolvedValue({ nodes: [] });
    listTasks.mockResolvedValue({ items: [task()] });
    getStuffing.mockResolvedValue(null);
    getDispatch.mockResolvedValue(null);
    listDates.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00Z",
    });
  });

  it("shows the shipping role sequence and blocks handoff until stuffing exists", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get('[aria-label="出运任务列表"]').text()).toContain(
      "领取出运任务",
    );
    expect(wrapper.get('[aria-label="出运事实总览"]').text()).toContain(
      "缺少当前装箱记录",
    );
    expect(wrapper.get('[aria-label="出运交接表单"]').text()).toContain(
      "先完成当前装箱记录",
    );
    expect(wrapper.text()).toContain(
      "完成工单只记录工作结果，不代替实际装船事实",
    );
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/dispatch", component: DispatchWorkbench }],
  });
  await router.push("/workspaces/dispatch?containerId=container-1");
  await router.isReady();
  const wrapper = mount(DispatchWorkbench, {
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
    nodeCode: "shipment_dispatch",
    containerId: container.id,
    taskDefinitionKey: "node-shipment_dispatch",
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
      workOrderDefinitionKey: "dispatch",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
