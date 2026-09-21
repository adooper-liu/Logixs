import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PickupWorkbench from "./PickupWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
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

describe("PickupWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      listNodes,
      listTasks,
      listDates,
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
  });

  it("shows the pickup role flow and separates availability, passage and work completion", async () => {
    const wrapper = await mountPage();
    expect(wrapper.get('[aria-label="提柜任务列表"]').text()).toContain(
      "领取提柜任务",
    );
    expect(wrapper.get('[aria-label="提柜事实总览"]').text()).toContain(
      "码头可提",
    );
    expect(wrapper.get('[aria-label="码头可提事实"]').text()).toContain(
      "提交可提复核",
    );
    expect(wrapper.get('[aria-label="重柜出场事实"]').text()).toContain(
      "提交 Gate Out 复核",
    );
    expect(wrapper.text()).toContain("只有经采信的 Gate Out 才代表货柜已提走");
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/pickup", component: PickupWorkbench }],
  });
  await router.push("/workspaces/pickup?containerId=container-1");
  await router.isReady();
  const wrapper = mount(PickupWorkbench, {
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
    nodeCode: "container_pickup",
    containerId: container.id,
    taskDefinitionKey: "node-container_pickup",
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
      workOrderDefinitionKey: "pickup",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}
