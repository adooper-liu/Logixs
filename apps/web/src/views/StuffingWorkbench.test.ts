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
const listWorkSessions = vi.fn();
const openWorkSession = vi.fn();
const updateWorkSession = vi.fn();
const activateWorkSession = vi.fn();

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

vi.mock("../api/workSessions", () => ({
  listWorkSessions: (...args: unknown[]) => listWorkSessions(...args),
  openWorkSession: (...args: unknown[]) => openWorkSession(...args),
  updateWorkSession: (...args: unknown[]) => updateWorkSession(...args),
  activateWorkSession: (...args: unknown[]) => activateWorkSession(...args),
}));

const container = {
  id: "44444444-4444-4444-8444-444444444444",
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
      listWorkSessions,
      openWorkSession,
      updateWorkSession,
      activateWorkSession,
    ])
      mock.mockReset();
    listContainers.mockResolvedValue({
      items: [container],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });
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
    listNodeTasks.mockResolvedValue({
      items: [nodeTask()],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });
    getSnapshot.mockResolvedValue(null);
    listDateFacts.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00.000Z",
    });
    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [],
      pageSize: 50,
      nextCursor: null,
    });
    openWorkSession.mockImplementation(async (command) => ({
      contractVersion: "work-session.v1",
      sessionId: "77777777-7777-4777-8777-777777777777",
      version: 1,
      status: "current",
      workbenchCode: command.workbenchCode,
      contextKey: "stuffing-context",
      routeContext: command.routeContext,
      subjectRef: command.subjectRef,
      taskRef: command.taskRef,
      domainVersionSeen: command.domainVersionSeen,
      activeItemKey: command.activeItemKey,
      contextMode: command.contextMode,
      displaySummary: command.displaySummary,
      lastOpenedAt: "2026-10-14T08:00:00.000Z",
      createdAt: "2026-10-14T08:00:00.000Z",
      updatedAt: "2026-10-14T08:00:00.000Z",
    }));
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

  it("shows snapshot-backed history as read-only without inventing a task", async () => {
    listContainers.mockImplementation(async (query?: { scope?: string }) => ({
      items:
        query?.scope === "active_stuffing_snapshot" ? [container] : [container],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    }));
    listNodeTasks.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });
    listLifecycleNodes.mockResolvedValue({ flow: null, nodes: [] });
    getSnapshot.mockResolvedValue(historicalSnapshot());
    getContainerCargo.mockResolvedValue({
      containerRecordId: container.id,
      allocationSetId: "allocation-1",
      allocationSetVersion: 1,
      items: [
        {
          replenishmentOrderLineId: "line-1",
          productSkuId: "sku-1",
          productNumber: "331-015",
          allocatedQuantity: "118",
          quantityUnit: "piece",
        },
      ],
    });
    const { wrapper, router } = await mountPageWithRouter();

    expect(wrapper.text()).toContain("历史事实只读");
    expect(wrapper.text()).not.toContain("保存装箱记录");
    expect(wrapper.text()).toContain("历史事实");
    expect(wrapper.text()).toContain("查看历史装箱事实");
    await wrapper
      .get('[aria-label="装箱任务列表"] button.queue-item')
      .trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({
      containerId: container.id,
    });
    expect(wrapper.text()).toContain("快照与当前装载一致");
    expect(wrapper.text()).toContain("历史事实只读");
    expect(wrapper.text()).toContain("未建立 stuffed 结论");
    expect(wrapper.text()).toContain("未记录、未接受");
    expect(wrapper.text()).not.toContain("保存装箱记录");
    expect(wrapper.text()).not.toContain("实际装箱时间表单");
    expect(wrapper.text()).not.toContain("领取任务");
  });

  it("keeps successful cargo data visible when date projection fails", async () => {
    listDateFacts.mockRejectedValue(new Error("network"));
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("833-066V00BK");
    expect(wrapper.text()).toContain("装箱日期暂时没能加载");
  });
});

async function mountPage() {
  return (await mountPageWithRouter()).wrapper;
}

async function mountPageWithRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/stuffing", component: StuffingWorkbench }],
  });
  await router.push(
    "/workspaces/stuffing?containerId=44444444-4444-4444-8444-444444444444&taskId=55555555-5555-4555-8555-555555555555",
  );
  await router.isReady();
  const wrapper = mount(StuffingWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title"],
          template:
            "<header><h1>{{ title }}</h1><slot name='actions' /></header>",
        },
      },
    },
  });
  await flushPromises();
  return { wrapper, router };
}

function historicalSnapshot() {
  return {
    snapshotId: "66666666-6666-4666-8666-666666666666",
    containerRecordId: container.id,
    version: 1,
    allocationSetId: "allocation-1",
    allocationSetVersion: 1,
    containerNumber: "HMMU4956442",
    sealNumber: "26H0407525",
    packageCount: 504,
    grossWeight: "7723",
    grossWeightUnit: "KGM" as const,
    netWeight: null,
    volume: "67.25",
    volumeUnit: "MTQ" as const,
    vgm: null,
    ingestionChannel: "file_import" as const,
    sourceSystem: "full-chain-sample",
    evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
    actorId: "source-import-service",
    reasonCode: "historical_stuffing_imported",
    createdAt: "2026-10-15T08:00:00.000Z",
    duplicate: false,
  };
}

function nodeTask() {
  return {
    id: "55555555-5555-4555-8555-555555555555",
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
