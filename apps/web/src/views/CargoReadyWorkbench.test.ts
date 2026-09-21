import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CargoReadyWorkbench from "./CargoReadyWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const getContainerCargo = vi.fn();
const listLifecycleNodes = vi.fn();
const listNodeTasks = vi.fn();
const listExternalWorkItems = vi.fn();
const getCargoReadyCompliance = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
  getContainer: (...args: unknown[]) => getContainer(...args),
  getContainerCargo: (...args: unknown[]) => getContainerCargo(...args),
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

const container = {
  id: "container-1",
  orderNumber: "SO-1",
  containerNumber: "MSCU1234567",
  currentStatus: "not_shipped",
  updatedAt: "2026-09-21T00:00:00.000Z",
};

describe("CargoReadyWorkbench", () => {
  beforeEach(() => {
    for (const mock of [
      listContainers,
      getContainer,
      getContainerCargo,
      listLifecycleNodes,
      listNodeTasks,
      listExternalWorkItems,
      getCargoReadyCompliance,
    ]) {
      mock.mockReset();
    }
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
      flow: {
        id: "flow-1",
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 1,
      },
      nodes: [
        {
          nodeInstanceId: "node-1",
          nodeCode: "cargo_ready",
          sequence: 1,
          state: "active",
          applicability: "required",
          completedAt: null,
          isCurrent: true,
        },
      ],
    });
    listNodeTasks.mockResolvedValue({ items: [nodeTask()] });
    listExternalWorkItems.mockResolvedValue({ items: [remediationItem()] });
    getCargoReadyCompliance.mockResolvedValue({
      assessmentId: "assessment-1",
      containerRecordId: container.id,
      version: 3,
      state: "decided",
      jurisdictionCountryCode: "ES",
      findings: [{ code: "missing-certificate" }],
      currentDecision: { decisionCode: "evidence_required" },
    });
  });

  it("renders real SKU facts and keeps lifecycle tasks separate from remediation", async () => {
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("833-066V00BK");
    expect(wrapper.text()).toContain("50 carton");
    expect(wrapper.get('[aria-label="生命周期任务"]').text()).toContain(
      "node-cargo_ready",
    );
    expect(wrapper.get('[aria-label="合规整改项"]').text()).toContain(
      "补齐欧盟证书",
    );
    expect(wrapper.get('[aria-label="备货合规状态"]').text()).toContain(
      "待补证",
    );
    expect(wrapper.get('a[aria-label="进入合规评审"]').attributes("href")).toBe(
      "/compliance?containerId=container-1",
    );
    expect(
      wrapper.get('[aria-label="生命周期任务"] a').attributes("href"),
    ).toBe("/tasks?containerId=container-1&task=task-1");
  });

  it("retains successful facts, reports partial failure and does not invent nodes", async () => {
    listLifecycleNodes.mockResolvedValue({ flow: null, nodes: [] });
    listExternalWorkItems.mockRejectedValue(new Error("network"));
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("833-066V00BK");
    expect(wrapper.text()).toContain("合规整改项暂时没能加载");
    expect(wrapper.text()).toContain("这柜尚未初始化生命周期流程");
    expect(wrapper.find('[aria-label="货柜节点"]').exists()).toBe(false);
  });
});

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/workspaces/cargo-ready", component: CargoReadyWorkbench },
      { path: "/tasks", component: { template: "<div />" } },
      { path: "/compliance", component: { template: "<div />" } },
    ],
  });
  await router.push("/workspaces/cargo-ready?containerId=container-1");
  await router.isReady();
  const wrapper = mount(CargoReadyWorkbench, {
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
    nodeCode: "cargo_ready",
    containerId: container.id,
    taskDefinitionKey: "node-cargo_ready",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "claim",
      workOrderId: "work-order-1",
      workOrderDefinitionKey: "prepare-cargo",
      assignmentState: "unassigned",
      assigneeId: null,
      dueAt: null,
    },
  };
}

function remediationItem() {
  return {
    id: "work-item-1",
    sourceModule: "compliance",
    sourceType: "cargo_ready_assessment",
    sourceRecordId: "assessment-1",
    sourceVersion: 3,
    containerId: container.id,
    taskDefinitionKey: "compliance-remediation",
    title: "补齐欧盟证书",
    detail: "提交有效证书证据",
    priority: "high",
    state: "open",
    assignedRoleCode: "cargo_ready_operator",
    evidenceRefs: [],
    dueAt: null,
    createdAt: "2026-09-21T00:00:00.000Z",
  };
}
