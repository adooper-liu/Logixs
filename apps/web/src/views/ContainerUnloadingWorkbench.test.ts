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
const appendReport = vi.fn();
const recordDateFact = vi.fn();
const claimWorkOrder = vi.fn();
const completeWorkOrder = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
  getContainer: (...args: unknown[]) => getContainer(...args),
}));
vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: (...args: unknown[]) => listNodes(...args),
}));
vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listTasks(...args),
  claimWorkOrder: (...args: unknown[]) => claimWorkOrder(...args),
  completeWorkOrder: (...args: unknown[]) => completeWorkOrder(...args),
}));
vi.mock("../api/lifecycleDateFacts", () => ({
  listLifecycleDateFacts: (...args: unknown[]) => listDates(...args),
  recordLifecycleDateFact: (...args: unknown[]) => recordDateFact(...args),
}));
vi.mock("../api/warehouseDelivery", () => ({
  getWarehouseDeliveryInstruction: (...args: unknown[]) =>
    getInstruction(...args),
}));
vi.mock("../api/containerUnloading", () => ({
  getContainerUnloadingReport: (...args: unknown[]) => getReport(...args),
  appendContainerUnloadingReport: (...args: unknown[]) => appendReport(...args),
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
      appendReport,
      recordDateFact,
      claimWorkOrder,
      completeWorkOrder,
    ])
      mock.mockReset();
    listContainers.mockResolvedValue({ items: [container] });
    getContainer.mockResolvedValue(container);
    listNodes.mockResolvedValue({ nodes: [] });
    listTasks.mockResolvedValue({ items: [task(), task("task-2")] });
    listDates.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00Z",
    });
    getInstruction.mockResolvedValue(null);
    getReport.mockResolvedValue(null);
    appendReport.mockReset();
    recordDateFact.mockReset();
    claimWorkOrder.mockReset();
    completeWorkOrder.mockReset();
  });

  it("shows the operational sequence and separates partial, completed and empty confirmation", async () => {
    const { wrapper } = await mountPage();
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

  it("keeps the professional draft when a same-container task changes", async () => {
    getInstruction.mockResolvedValue({
      instructionId: "instruction-1",
      containerRecordId: "container-1",
      version: 1,
      warehouseLocationId: "warehouse-1",
      warehouseCode: "VLS",
      warehouseName: "Barcelona VLS",
      unlocode: "ESBCN",
      timezone: "Europe/Madrid",
      appointmentStartAt: null,
      appointmentEndAt: null,
      appointmentReference: null,
      evidenceRefs: [],
      actorId: "operator",
      reasonCode: "delivery_instruction_confirmed",
      createdAt: "2026-09-21T00:00:00Z",
      duplicate: false,
    });
    const { wrapper, router } = await mountPage();
    const started = wrapper.get('input[type="datetime-local"]');
    await started.setValue("2026-04-24T09:15");
    expect((started.element as HTMLInputElement).value).toBe(
      "2026-04-24T09:15",
    );
    await wrapper.get('[data-mode-control="archive"]').trigger("click");
    expect(
      wrapper.get('[data-mode-control="archive"]').attributes("aria-pressed"),
    ).toBe("true");

    await router.push({
      path: "/workspaces/unloading",
      query: { containerId: "container-1", taskId: "task-2" },
    });
    await flushPromises();
    expect((started.element as HTMLInputElement).value).toBe(
      "2026-04-24T09:15",
    );
    expect(
      wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(wrapper.find('[data-mode-control="archive"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      wrapper.get('[data-context-mode="archive"]').attributes("hidden"),
    ).toBeDefined();
  });

  it("keeps professional unloading available when the global task queue fails", async () => {
    getInstruction.mockResolvedValue({
      instructionId: "instruction-1",
      containerRecordId: "container-1",
      version: 1,
      warehouseLocationId: "warehouse-1",
      warehouseCode: "VLS",
      warehouseName: "Barcelona VLS",
      unlocode: "ESBCN",
      timezone: "Europe/Madrid",
      appointmentStartAt: null,
      appointmentEndAt: null,
      appointmentReference: null,
      evidenceRefs: [],
      actorId: "operator",
      reasonCode: "delivery_instruction_confirmed",
      createdAt: "2026-09-21T00:00:00Z",
      duplicate: false,
    });
    listTasks.mockImplementation((input: unknown) => {
      const params = input as { containerId?: string } | undefined;
      return params?.containerId
        ? Promise.resolve({ items: [task()] })
        : Promise.reject(new Error("queue unavailable"));
    });
    const { wrapper } = await mountPage();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "专业事实办理仍可继续",
    );
    const actionPanel = wrapper.get('[aria-label="卸柜操作区"]');
    await actionPanel
      .get('input[type="datetime-local"]')
      .setValue("2026-04-24T09:15");
    const inputs = actionPanel.findAll("input");
    await inputs[1]!.setValue("10");
    await inputs[3]!.setValue("10");
    const textareas = actionPanel.findAll("textarea");
    await textareas[1]!.setValue("evidence-1");
    expect(
      (actionPanel.get("button.primary").element as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(wrapper.get('[aria-label="卸柜工单操作"]').text()).toContain(
      "当前没有可执行动作",
    );
  });

  it("keeps direct claim retry reachable with the original idempotency key", async () => {
    getInstruction.mockResolvedValue({
      instructionId: "instruction-1",
      containerRecordId: "container-1",
      version: 1,
      warehouseLocationId: "warehouse-1",
      warehouseCode: "VLS",
      warehouseName: "Barcelona VLS",
      unlocode: "ESBCN",
      timezone: "Europe/Madrid",
      appointmentStartAt: null,
      appointmentEndAt: null,
      appointmentReference: null,
      evidenceRefs: [],
      actorId: "operator",
      reasonCode: "delivery_instruction_confirmed",
      createdAt: "2026-09-21T00:00:00Z",
      duplicate: false,
    });
    claimWorkOrder
      .mockRejectedValueOnce(new Error("network result unknown"))
      .mockResolvedValueOnce({
        workOrderId: "work-1",
        workOrderState: "in_progress",
        assignmentState: "assigned",
        assigneeId: "operator",
        taskId: "task-1",
        taskState: "in_progress",
        applied: true,
        clientOperationId: "op-1",
        receptionState: "received",
        businessDecisionState: "accepted",
        commitState: "committed",
        rejectionReasonCode: null,
      });
    const { wrapper } = await mountPage();
    const action = wrapper.get(".task-action");
    await action.get("button").trigger("click");
    await flushPromises();
    expect(action.find("button.retry").exists()).toBe(true);
    await action.get("button.retry").trigger("click");
    await flushPromises();
    expect(claimWorkOrder).toHaveBeenCalledTimes(2);
    expect(claimWorkOrder.mock.calls[0]?.[1].idempotencyKey).toBe(
      claimWorkOrder.mock.calls[1]?.[1].idempotencyKey,
    );
  });

  it("keeps a held A report from being appended again after router A-to-B-to-A", async () => {
    getInstruction.mockResolvedValue(instructionForTest());
    let reportReads = 0;
    getReport.mockImplementation(() => {
      reportReads++;
      return Promise.resolve(partialReport());
    });
    const heldA = deferred<ReturnType<typeof partialReport>>();
    appendReport
      .mockReturnValueOnce(heldA.promise)
      .mockResolvedValueOnce({ ...partialReport(), reportId: "b-report" });
    const { wrapper, router } = await mountPage();
    await router.push({
      path: "/workspaces/unloading",
      query: { containerId: "container-1", taskId: "task-1" },
    });
    await flushPromises();

    const actionPanel = wrapper.get(".actions");
    await actionPanel.get(".segmented").findAll("button")[1]!.trigger("click");
    await actionPanel
      .get('input[type="datetime-local"]')
      .setValue("2026-04-23T08:00");
    const inputs = actionPanel.findAll("input");
    await inputs[1]!.setValue("524");
    await inputs[3]!.setValue("224");
    await actionPanel.findAll("textarea")[1]!.setValue("evidence-1");
    await actionPanel.get("button.primary").trigger("click");
    await vi.waitFor(() => expect(appendReport).toHaveBeenCalledTimes(1));

    await router.push({
      path: "/workspaces/unloading",
      query: { containerId: "container-1", taskId: "task-2" },
    });
    await flushPromises();
    const bPanel = wrapper.get(".actions");
    await bPanel.get(".segmented").findAll("button")[1]!.trigger("click");
    await bPanel
      .get('input[type="datetime-local"]')
      .setValue("2026-04-23T08:00");
    const bInputs = bPanel.findAll("input");
    await bInputs[1]!.setValue("524");
    await bInputs[3]!.setValue("224");
    await bPanel.findAll("textarea")[1]!.setValue("evidence-1");
    await bPanel.get("button.primary").trigger("click");
    await vi.waitFor(() => expect(appendReport).toHaveBeenCalledTimes(2));

    await router.push({
      path: "/workspaces/unloading",
      query: { containerId: "container-1", taskId: "task-1" },
    });
    await flushPromises();
    const aAgain = wrapper.get(".actions");
    await aAgain.get("button.primary").trigger("click");
    await flushPromises();
    expect(reportReads).toBeGreaterThanOrEqual(1);
    expect(appendReport).toHaveBeenCalledTimes(2);
    expect(aAgain.get('[role="alert"]').text()).toContain("未完成");

    heldA.resolve(partialReport());
    await flushPromises();
    expect(wrapper.text()).toContain("未完成");
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
  return { wrapper, router };
}

function task(id = "task-1") {
  const suffix = id.replace(/^task-/, "");
  return {
    id,
    flowInstanceId: `flow-${suffix}`,
    nodeInstanceId: `node-${suffix}`,
    nodeCode: "container_unloading",
    containerId: container.id,
    taskDefinitionKey: "node-container_unloading",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [
      {
        id: `work-${suffix}`,
        workOrderDefinitionKey: "unloading",
        state: "pending",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
        completedAt: null,
      },
    ],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: `work-${suffix}`,
      workOrderDefinitionKey: "unloading",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
  };
}

function instructionForTest() {
  return {
    instructionId: "instruction-1",
    containerRecordId: "container-1",
    version: 1,
    warehouseLocationId: "warehouse-1",
    warehouseCode: "VLS",
    warehouseName: "Barcelona VLS",
    unlocode: "ESBCN",
    timezone: "Europe/Madrid",
    appointmentStartAt: null,
    appointmentEndAt: null,
    appointmentReference: null,
    evidenceRefs: [],
    actorId: "operator",
    reasonCode: "delivery_instruction_confirmed",
    createdAt: "2026-09-21T00:00:00Z",
    duplicate: false,
  };
}

function partialReport() {
  return {
    reportId: "report-1",
    containerRecordId: "container-1",
    version: 2,
    warehouseLocationId: "warehouse-1",
    operationState: "partial" as const,
    startedAt: "2026-04-23T06:00:00.000Z",
    completedAt: null,
    expectedQuantity: "524",
    unloadedQuantity: "300",
    remainingQuantity: "224",
    damagedQuantity: "0",
    shortageQuantity: "0",
    quantityUnit: "carton" as const,
    sealCheck: "matched" as const,
    exceptionResolved: false,
    exceptionNotes: null,
    evidenceRefs: ["evidence-1"],
    actorId: "operator",
    reasonCode: "unloading_progress_reported",
    createdAt: "2026-09-21T00:00:00Z",
    duplicate: false,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
