import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomsWorkbench from "./CustomsWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
const getCase = vi.fn();
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
vi.mock("../api/customsClearance", () => ({
  getCustomsClearanceCase: (...args: unknown[]) => getCase(...args),
  replaceCustomsClearanceCase: vi.fn(),
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
  currentStatus: "at_port",
  updatedAt: "2026-09-21T00:00:00Z",
};

describe("CustomsWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      listNodes,
      listTasks,
      getCase,
      listDates,
    ])
      mock.mockReset();
    listContainers.mockResolvedValue({ items: [container] });
    getContainer.mockResolvedValue(container);
    listNodes.mockResolvedValue({ nodes: [] });
    listTasks.mockResolvedValue({ items: [task()] });
    getCase.mockResolvedValue(null);
    listDates.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00Z",
    });
  });

  it("shows the customs role flow and keeps work completion separate from passage", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get('[aria-label="清关任务列表"]').text()).toContain(
      "领取清关任务",
    );
    expect(wrapper.get('[aria-label="清关事实总览"]').text()).toContain(
      "尚未建立清关案件",
    );
    expect(wrapper.get('[aria-label="清关案件表单"]').text()).toContain(
      "进口国/地区代码",
    );
    expect(wrapper.text()).toContain(
      "完成工单只记录清关岗位工作，不等于海关放行或流程过站",
    );
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/customs", component: CustomsWorkbench }],
  });
  await router.push("/workspaces/customs?containerId=container-1");
  await router.isReady();
  const wrapper = mount(CustomsWorkbench, {
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
    nodeCode: "customs_clearance",
    containerId: container.id,
    taskDefinitionKey: "node-customs_clearance",
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
      workOrderDefinitionKey: "customs",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
