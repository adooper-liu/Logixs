import { flushPromises, mount } from "@vue/test-utils";
import type { TaskActionClaimWorkOrderResultV1 } from "@logix/contracts";
import { defineComponent, nextTick, shallowRef, type PropType } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TaskAiAssistanceContext,
  TaskAiAssistanceState,
} from "../composables/useTaskAiAssistance";
import type {
  TaskCollaborationContext,
  TaskCollaborationPanelModel,
} from "../composables/useTaskCollaboration";
import StuffingSnapshotForm from "../components/stuffing/StuffingSnapshotForm.vue";
import TaskContextPanel, {
  type TaskContextPanelMode,
} from "../components/task/TaskContextPanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import WorkbenchLayout from "../components/workbench/WorkbenchLayout.vue";
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
const collaborationModel = {
  send: vi.fn(),
  refresh: vi.fn(),
  retrySend: vi.fn(),
  loadMore: vi.fn(),
} as unknown as TaskCollaborationPanelModel;
const useTaskCollaboration = vi.fn(
  (context: Readonly<{ value: TaskCollaborationContext | null }>) => {
    void context;
    return collaborationModel;
  },
);
const aiReceipt = shallowRef<TaskActionClaimWorkOrderResultV1 | null>(null);
const aiState = {
  receipt: aiReceipt,
  confirm: vi.fn(),
  reject: vi.fn(),
  retry: vi.fn(),
  refresh: vi.fn(),
} as unknown as TaskAiAssistanceState;
let aiRefreshTask: (() => Promise<void> | void) | null = null;
const useTaskAiAssistance = vi.fn(
  (
    _context: Readonly<{ value: TaskAiAssistanceContext | null }>,
    options: { refreshTask(): Promise<void> | void },
  ) => {
    aiRefreshTask = options.refreshTask;
    return aiState;
  },
);

vi.mock("../composables/useTaskCollaboration", () => ({
  useTaskCollaboration: (
    context: Readonly<{ value: TaskCollaborationContext | null }>,
  ) => useTaskCollaboration(context),
}));
vi.mock("../composables/useTaskAiAssistance", () => ({
  useTaskAiAssistance: (
    context: Readonly<{ value: TaskAiAssistanceContext | null }>,
    options: { refreshTask(): Promise<void> | void },
  ) => useTaskAiAssistance(context, options),
}));

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

const ContextPanelStub = defineComponent({
  name: "TaskContextPanel",
  props: {
    modelValue: {
      type: String as PropType<TaskContextPanelMode>,
      required: true,
    },
    contextKey: { type: String, default: null },
    modes: {
      type: Array as PropType<readonly TaskContextPanelMode[]>,
      required: true,
    },
    collaboration: { type: Object, default: null },
    ai: { type: Object, default: null },
  },
  emits: [
    "update:modelValue",
    "submit",
    "retry",
    "loadMore",
    "confirmAi",
    "rejectAi",
    "retryAi",
    "refreshAi",
  ],
  watch: {
    contextKey: {
      handler() {
        this.$emit("update:modelValue", this.modes[0] ?? "work");
      },
      flush: "sync",
    },
    modes: {
      handler(modes: readonly TaskContextPanelMode[]) {
        if (!modes.includes(this.modelValue)) {
          this.$emit("update:modelValue", modes[0] ?? "work");
        }
      },
      flush: "sync",
    },
  },
  methods: {
    selectMode(mode: TaskContextPanelMode) {
      if (this.modes.includes(mode) && mode !== this.modelValue) {
        this.$emit("update:modelValue", mode);
      }
    },
  },
  template: `
    <section
      data-testid="task-context-panel"
      :data-context-key="contextKey"
      :data-modes="modes.join(',')"
      :data-active-mode="modelValue"
      :data-has-collaboration="String(Boolean(collaboration))"
      :data-has-ai="String(Boolean(ai))"
    >
      <slot name="anchor" />
      <div data-testid="context-work"><slot name="work" /></div>
      <div data-testid="context-archive"><slot name="archive" /></div>
      <button data-testid="context-submit" @click="$emit('submit')">发送</button>
      <button data-testid="context-retry-thread" @click="$emit('retry', 'thread')">重试读取</button>
      <button data-testid="context-retry-send" @click="$emit('retry', 'send')">重试发送</button>
      <button data-testid="context-load-more" @click="$emit('loadMore')">更早消息</button>
      <button data-testid="context-confirm-ai" @click="$emit('confirmAi')">确认 AI</button>
      <button data-testid="context-reject-ai" @click="$emit('rejectAi', '稍后处理')">拒绝 AI</button>
      <button data-testid="context-retry-ai" @click="$emit('retryAi', 'confirm')">恢复 AI</button>
      <button data-testid="context-refresh-ai" @click="$emit('refreshAi')">刷新 AI</button>
      <button v-for="mode in modes" :key="mode" :data-testid="'mode-' + mode" :data-mode-control="mode" :aria-pressed="modelValue === mode" @click="selectMode(mode)">{{ mode }}</button>
    </section>
  `,
});

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
    useTaskCollaboration.mockClear();
    useTaskAiAssistance.mockClear();
    vi.mocked(collaborationModel.send).mockClear();
    vi.mocked(collaborationModel.refresh).mockClear();
    vi.mocked(collaborationModel.retrySend).mockClear();
    vi.mocked(collaborationModel.loadMore).mockClear();
    vi.mocked(aiState.confirm).mockClear();
    vi.mocked(aiState.reject).mockClear();
    vi.mocked(aiState.retry).mockClear();
    vi.mocked(aiState.refresh).mockClear();
    aiReceipt.value = null;
    aiRefreshTask = null;
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

  it("opts into standard geometry with a controlled queue-first mobile screen", async () => {
    const wrapper = await mountPage();
    const frame = wrapper.getComponent(RoleWorkbenchFrame);
    const layout = wrapper.findComponent(WorkbenchLayout);

    expect(frame.props("responsiveMode")).toBe("standard");
    expect(frame.props("mobileScreen")).toBe("queue");
    expect(layout.props("responsiveMode")).toBe("standard");
    expect(
      wrapper
        .findAll("[data-workbench-pane]")
        .map((pane) => pane.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
  });

  it("opens a work session with the bounded screen and context pointer", async () => {
    await mountPage();

    expect(openWorkSession).toHaveBeenCalledWith(
      expect.objectContaining({
        contextMode: "screen:queue;mode:work",
      }),
    );
  });

  it("advances from the real queue task to detail and then context on mobile", async () => {
    const { wrapper, router } = await mountPageWithRouter(
      "/workspaces/stuffing",
    );
    const frame = wrapper.getComponent(RoleWorkbenchFrame);
    const layout = wrapper.findComponent(WorkbenchLayout);

    expect(frame.props("mobileScreen")).toBe("queue");
    await wrapper
      .get('[aria-label="装箱任务列表"] button.queue-item')
      .trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({
      containerId: container.id,
      taskId: "55555555-5555-4555-8555-555555555555",
    });
    expect(frame.props("mobileScreen")).toBe("detail");

    await layout.get('[data-mobile-target="context"]').trigger("click");
    expect(frame.props("mobileScreen")).toBe("context");
    expect(
      wrapper
        .findAll('[data-workbench-pane][data-mobile-active="true"]')
        .map((pane) => pane.attributes("data-workbench-pane")),
    ).toEqual(["context"]);
  });

  it("renders neutral mobile breadcrumb and rail summaries without internal identifiers", async () => {
    const wrapper = await mountPage();

    expect(
      wrapper.get('[data-testid="stuffing-mobile-breadcrumb"]').text(),
    ).toBe("KOCU4960726 · 装箱任务 · 办理");
    const queueRail = wrapper.get('[data-testid="stuffing-queue-rail"]');
    expect(queueRail.text()).toBe("装箱1 项");
    expect(queueRail.attributes("aria-label")).toBe(
      "当前货柜 KOCU4960726，1 项待办",
    );
    expect(queueRail.attributes("title")).toBe(
      "当前货柜 KOCU4960726，1 项待办",
    );
    await wrapper.get('[aria-label="折叠装箱办理"]').trigger("click");
    expect(wrapper.get('[data-testid="stuffing-context-rail"]').text()).toBe(
      "继续办理",
    );
    expect(wrapper.text()).not.toContain(
      "55555555-5555-4555-8555-555555555555",
    );
    expect(wrapper.text()).not.toContain(
      "66666666-6666-4666-8666-666666666666",
    );
  });

  it("keeps the draft form and context mode independent from mobile pane changes", async () => {
    getSnapshot.mockResolvedValue(historicalSnapshot());
    const { wrapper } = await mountPageWithRouter(undefined, true);
    const layout = wrapper.findComponent(WorkbenchLayout);
    const form = wrapper.get('[aria-label="装箱结果表单"]');
    const sealNumber = form.findAll("input")[1]!;
    await sealNumber.setValue("MOBILE-DRAFT");
    await wrapper.get('[data-testid="mode-ai"]').trigger("click");
    const formElement = sealNumber.element;

    for (const screen of ["detail", "context", "queue", "detail"] as const) {
      await layout.get(`[data-mobile-target="${screen}"]`).trigger("click");
    }

    expect(
      wrapper
        .get('[data-testid="task-context-panel"]')
        .attributes("data-active-mode"),
    ).toBe("ai");
    expect(
      wrapper.get('[aria-label="装箱结果表单"]').findAll("input")[1]!.element,
    ).toBe(formElement);
    expect(
      (
        wrapper.get('[aria-label="装箱结果表单"]').findAll("input")[1]!
          .element as HTMLInputElement
      ).value,
    ).toBe("MOBILE-DRAFT");
  });

  it("encodes and restores only bounded mobile/context pointers", async () => {
    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [sessionWithPointer("screen:context;mode:collaboration")],
      pageSize: 50,
      nextCursor: null,
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "context",
    );
    expect(
      wrapper
        .get('[data-testid="task-context-panel"]')
        .attributes("data-active-mode"),
    ).toBe("collaboration");

    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [sessionWithPointer("edit_snapshot")],
      pageSize: 50,
      nextCursor: null,
    });
    const legacy = await mountPageWithRouter(undefined, false);
    await flushPromises();
    expect(
      legacy.wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen"),
    ).toBe("detail");
    expect(
      legacy.wrapper
        .get('[data-testid="task-context-panel"]')
        .attributes("data-active-mode"),
    ).toBe("work");
  });

  it("restores collaboration after the exact task context finishes loading", async () => {
    const selectionTasks = deferred<{
      items: ReturnType<typeof nodeTask>[];
      pageInfo: { nextCursor: null; hasNextPage: false; pageSize: number };
    }>();
    listNodeTasks.mockImplementation((input) =>
      input?.containerId
        ? selectionTasks.promise
        : Promise.resolve(taskPage([nodeTask()])),
    );
    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [sessionWithPointer("screen:context;mode:collaboration")],
      pageSize: 50,
      nextCursor: null,
    });

    const { wrapper } = await mountPageWithRouter();
    selectionTasks.resolve(taskPage([nodeTask()]));
    await flushPromises();

    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "context",
    );
    expect(activeContextMode(wrapper)).toBe("collaboration");

    await wrapper.get('[data-testid="mode-work"]').trigger("click");
    await nextTick();
    expect(activeContextMode(wrapper)).toBe("work");
  });

  it("keeps an AI pointer pending until the claim action projection arrives", async () => {
    let selectionLoad = 0;
    listNodeTasks.mockImplementation((input) => {
      if (!input?.containerId) return Promise.resolve(taskPage([nodeTask()]));
      selectionLoad += 1;
      return Promise.resolve(
        taskPage([
          selectionLoad === 1 ? nodeTask({ nextAction: null }) : nodeTask(),
        ]),
      );
    });
    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [sessionWithPointer("screen:context;mode:ai")],
      pageSize: 50,
      nextCursor: null,
    });

    const wrapper = await mountPage();
    expect(activeContextMode(wrapper)).toBe("work");

    await aiRefreshTask?.();
    await flushPromises();

    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "context",
    );
    expect(activeContextMode(wrapper)).toBe("ai");

    await wrapper.get('[data-testid="mode-work"]').trigger("click");
    await flushPromises();
    expect(activeContextMode(wrapper)).toBe("work");
  });

  it("falls back to work when the settled task projection has no claim action", async () => {
    listNodeTasks.mockResolvedValue(taskPage([nodeTask({ nextAction: null })]));
    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [sessionWithPointer("screen:context;mode:ai")],
      pageSize: 50,
      nextCursor: null,
    });

    const wrapper = await mountPage();

    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "context",
    );
    expect(activeContextMode(wrapper)).toBe("work");
  });

  it("does not apply route A's pending AI pointer after navigating to route B", async () => {
    const containerB = {
      ...container,
      id: "48888888-8888-4888-8888-888888888888",
      containerNumber: "KOCU4960888",
    };
    const taskB = nodeTask({
      id: "58888888-8888-4888-8888-888888888888",
      containerId: containerB.id,
      workOrders: [
        {
          ...nodeTask().workOrders[0],
          id: "68888888-8888-4888-8888-888888888888",
        },
      ],
      nextAction: {
        ...nodeTask().nextAction,
        workOrderId: "68888888-8888-4888-8888-888888888888",
      },
    });
    listNodeTasks.mockImplementation((input) => {
      if (!input?.containerId)
        return Promise.resolve(taskPage([nodeTask(), taskB]));
      return Promise.resolve(
        taskPage(
          input.containerId === containerB.id
            ? [taskB]
            : [nodeTask({ nextAction: null })],
        ),
      );
    });
    getContainer.mockImplementation((id) =>
      Promise.resolve(id === containerB.id ? containerB : container),
    );
    listWorkSessions.mockResolvedValue({
      contractVersion: "work-session-page.v1",
      items: [sessionWithPointer("screen:context;mode:ai")],
      pageSize: 50,
      nextCursor: null,
    });

    const { wrapper, router } = await mountPageWithRouter();
    await router.replace({
      path: "/workspaces/stuffing",
      query: { containerId: containerB.id, taskId: taskB.id },
    });
    await flushPromises();
    expect(activeContextMode(wrapper)).toBe("work");
  });

  it("keeps invalid and legacy pointers at detail and work without stale restoration", async () => {
    for (const pointer of ["edit_snapshot", "screen:unknown;mode:ai"]) {
      listWorkSessions.mockResolvedValue({
        contractVersion: "work-session-page.v1",
        items: [sessionWithPointer(pointer)],
        pageSize: 50,
        nextCursor: null,
      });
      const { wrapper } = await mountPageWithRouter();
      await flushPromises();

      expect(
        wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen"),
      ).toBe("detail");
      expect(activeContextMode(wrapper)).toBe("work");
      wrapper.unmount();
    }
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

  it("binds one shared context panel to the exact task and work order", async () => {
    const wrapper = await mountPage();
    const context = wrapper.get('[data-testid="task-context-panel"]');

    expect(wrapper.findAll('[data-testid="task-context-panel"]')).toHaveLength(
      1,
    );
    expect(context.attributes()).toMatchObject({
      "data-context-key": `container:${container.id}|node_task:55555555-5555-4555-8555-555555555555|work_order:66666666-6666-4666-8666-666666666666`,
      "data-modes": "work,archive,collaboration,ai",
      "data-has-collaboration": "true",
      "data-has-ai": "true",
    });
    expect(
      wrapper.get('[data-testid="archive-panel"]').attributes(),
    ).toMatchObject({
      "data-container-id": container.id,
      "data-task-id": "55555555-5555-4555-8555-555555555555",
    });
    const collaborationContext = useTaskCollaboration.mock.calls[0]![0] as {
      value: TaskCollaborationContext | null;
    };
    expect(collaborationContext.value).toMatchObject({
      taskId: "55555555-5555-4555-8555-555555555555",
      subjectRef: { kind: "container", id: container.id },
      workRef: {
        kind: "node_task",
        id: "55555555-5555-4555-8555-555555555555",
      },
    });
    const aiContext = useTaskAiAssistance.mock.calls[0]![0] as {
      value: TaskAiAssistanceContext | null;
    };
    expect(aiContext.value).toBeNull();
    await wrapper.get('[data-testid="mode-ai"]').trigger("click");
    expect(aiContext.value).toEqual(collaborationContext.value);
    expect(wrapper.text()).not.toContain("actor-secret-id");
  });

  it("fails closed when nextAction does not resolve to a task work order", async () => {
    listNodeTasks.mockResolvedValue({
      items: [nodeTask({ workOrders: [] })],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });
    const wrapper = await mountPage();
    const context = wrapper.get('[data-testid="task-context-panel"]');

    expect(context.attributes("data-context-key")).toBeUndefined();
    expect(context.attributes("data-modes")).toBe("work");
    expect(wrapper.find('[data-testid="archive-panel"]').exists()).toBe(false);
    const collaborationContext = useTaskCollaboration.mock.calls[0]![0] as {
      value: TaskCollaborationContext | null;
    };
    expect(collaborationContext.value).toBeNull();
    const aiContext = useTaskAiAssistance.mock.calls[0]![0] as {
      value: TaskAiAssistanceContext | null;
    };
    expect(aiContext.value).toBeNull();
  });

  it("keeps archive and collaboration but hides AI for complete actions", async () => {
    listNodeTasks.mockResolvedValue({
      items: [
        nodeTask({
          nextAction: {
            actionCode: "work_execution.complete_work_order",
            workOrderId: "66666666-6666-4666-8666-666666666666",
            workOrderDefinitionKey: "stuffing",
            assignmentState: "assigned",
            assigneeId: "actor-secret-id",
            dueAt: null,
          },
        }),
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });
    const wrapper = await mountPage();
    const context = wrapper.get('[data-testid="task-context-panel"]');
    expect(context.attributes("data-modes")).toBe("work,archive,collaboration");
    expect(context.attributes("data-has-ai")).toBe("false");
    expect(wrapper.text()).not.toContain("actor-secret-id");
  });

  it("bridges shared collaboration and AI events", async () => {
    const wrapper = await mountPage();
    await wrapper.get('[data-testid="context-submit"]').trigger("click");
    await wrapper.get('[data-testid="context-retry-thread"]').trigger("click");
    await wrapper.get('[data-testid="context-retry-send"]').trigger("click");
    await wrapper.get('[data-testid="context-load-more"]').trigger("click");
    await wrapper.get('[data-testid="context-confirm-ai"]').trigger("click");
    await wrapper.get('[data-testid="context-reject-ai"]').trigger("click");
    await wrapper.get('[data-testid="context-retry-ai"]').trigger("click");
    await wrapper.get('[data-testid="context-refresh-ai"]').trigger("click");

    expect(collaborationModel.send).toHaveBeenCalledTimes(1);
    expect(collaborationModel.refresh).toHaveBeenCalledTimes(1);
    expect(collaborationModel.retrySend).toHaveBeenCalledTimes(1);
    expect(collaborationModel.loadMore).toHaveBeenCalledTimes(1);
    expect(aiState.confirm).toHaveBeenCalledTimes(1);
    expect(aiState.reject).toHaveBeenCalledWith("稍后处理");
    expect(aiState.retry).toHaveBeenCalledWith("confirm");
    expect(aiState.refresh).toHaveBeenCalledTimes(1);
  });

  it("preserves the dirty form instance across a same-context AI refresh with an equal new snapshot", async () => {
    getSnapshot.mockResolvedValue(historicalSnapshot());
    const { wrapper } = await mountPageWithRouter(undefined, true);
    getSnapshot.mockResolvedValue({ ...historicalSnapshot() });
    const form = wrapper.get('[aria-label="装箱结果表单"]');
    const sealNumber = form.findAll("input")[1]!;
    const packageCount = form.findAll("input")[2]!;
    await sealNumber.setValue("DIRTY-SEAL");
    await packageCount.setValue("777");
    const snapshotForm = wrapper.findComponent(StuffingSnapshotForm);
    expect(snapshotForm.emitted("dirty-change")?.at(-1)).toEqual([true]);
    (packageCount.element as HTMLInputElement).focus();
    expect(sealNumber.element).toHaveProperty("value", "DIRTY-SEAL");
    expect(aiRefreshTask).not.toBeNull();
    await aiRefreshTask?.();
    await flushPromises();
    const refreshedInputs = wrapper
      .get('[aria-label="装箱结果表单"]')
      .findAll("input");
    const refreshedSealNumber = refreshedInputs[1]!;
    const refreshedPackageCount = refreshedInputs[2]!;
    expect(refreshedSealNumber.element).toBe(sealNumber.element);
    expect(refreshedSealNumber.element).toHaveProperty("value", "DIRTY-SEAL");
    expect(refreshedPackageCount.element).toHaveProperty("value", "777");
    expect(snapshotForm.emitted("dirty-change")?.at(-1)).toEqual([true]);
    expect(document.activeElement).toBe(refreshedPackageCount.element);
    wrapper.unmount();
  });

  it("reopens AI after a programmatic context fallback without a user choice", async () => {
    const { wrapper } = await mountPageWithRouter(undefined, true, true);
    const panel = wrapper.getComponent(TaskContextPanel);
    const contextKey = panel.props("contextKey");
    expect(contextKey).toBe(
      `container:${container.id}|node_task:55555555-5555-4555-8555-555555555555|work_order:66666666-6666-4666-8666-666666666666`,
    );
    await panel.get('[data-mode-control="ai"]').trigger("click");
    expect(panel.props("modelValue")).toBe("ai");
    const refreshTasks = deferred<ReturnType<typeof taskPage>>();
    listNodeTasks.mockImplementation((input) =>
      input?.containerId
        ? refreshTasks.promise
        : Promise.resolve(taskPage([nodeTask()])),
    );

    const refreshing = Promise.resolve(aiRefreshTask?.());
    await flushPromises();
    expect(panel.props("contextKey")).toBeNull();
    expect(panel.props("modelValue")).toBe("work");
    expect(panel.emitted("update:modelValue")?.at(-1)).toEqual(["work"]);

    refreshTasks.resolve(taskPage([nodeTask()]));
    await refreshing;
    await flushPromises();

    expect(panel.props("contextKey")).toBe(contextKey);
    expect(panel.props("modelValue")).toBe("ai");
    expect(
      panel.get('[data-mode-control="ai"]').attributes("aria-pressed"),
    ).toBe("true");
    wrapper.unmount();
  });

  it.each(["pointer", "Enter", " "])(
    "keeps a real %s work-mode activation when an AI refresh finishes late",
    async (activation) => {
      getSnapshot.mockResolvedValue(historicalSnapshot());
      const { wrapper, router } = await mountPageWithRouter(
        undefined,
        true,
        true,
      );
      const panel = wrapper.getComponent(TaskContextPanel);
      await panel.get('[data-mode-control="ai"]').trigger("click");
      expect(panel.props("modelValue")).toBe("ai");

      const form = wrapper.get('[aria-label="装箱结果表单"]');
      const sealNumber = form.findAll("input")[1]!;
      await sealNumber.setValue("DIRTY-DURING-AI-REFRESH");
      const snapshotForm = wrapper.findComponent(StuffingSnapshotForm);
      const formElement = sealNumber.element;
      const contextKey = panel.props("contextKey");
      expect(contextKey).toBe(
        `container:${container.id}|node_task:55555555-5555-4555-8555-555555555555|work_order:66666666-6666-4666-8666-666666666666`,
      );
      const routeQuery = { ...router.currentRoute.value.query };
      const refreshTasks = deferred<ReturnType<typeof taskPage>>();
      listNodeTasks.mockImplementation((input) =>
        input?.containerId
          ? refreshTasks.promise
          : Promise.resolve(taskPage([nodeTask()])),
      );

      const refreshing = Promise.resolve(aiRefreshTask?.());
      await flushPromises();
      expect(panel.props("contextKey")).toBeNull();
      expect(panel.props("modelValue")).toBe("work");
      const fallbackEmits = panel.emitted("update:modelValue")?.length;
      const workControl = panel.get('[data-mode-control="work"]');
      expect(workControl.attributes("aria-pressed")).toBe("true");

      if (activation !== "pointer") {
        (workControl.element as HTMLButtonElement).focus();
        await workControl.trigger("keydown", { key: activation });
        await workControl.trigger("keyup", { key: activation });
      }
      // DOM test runners do not synthesize native button clicks from keyboard events.
      // detail=0 represents the single click produced by Enter/Space in a browser.
      await workControl.trigger("click", {
        detail: activation === "pointer" ? 1 : 0,
      });
      expect(panel.emitted("update:modelValue")).toHaveLength(fallbackEmits!);
      expect(panel.props("modelValue")).toBe("work");

      refreshTasks.resolve(taskPage([nodeTask()]));
      await refreshing;
      await flushPromises();

      expect(panel.props("modelValue")).toBe("work");
      expect(router.currentRoute.value.query).toEqual(routeQuery);
      expect(panel.props("contextKey")).toBe(contextKey);
      expect(
        wrapper.get('[data-testid="archive-panel"]').attributes(),
      ).toMatchObject({
        "data-container-id": container.id,
        "data-task-id": "55555555-5555-4555-8555-555555555555",
      });
      const refreshedSealNumber = wrapper
        .get('[aria-label="装箱结果表单"]')
        .findAll("input")[1]!;
      expect(refreshedSealNumber.element).toBe(formElement);
      expect(refreshedSealNumber.element).toHaveProperty(
        "value",
        "DIRTY-DURING-AI-REFRESH",
      );
      expect(snapshotForm.emitted("dirty-change")?.at(-1)).toEqual([true]);
      expect(wrapper.getComponent(StuffingSnapshotForm).vm.$).toBe(
        snapshotForm.vm.$,
      );
      wrapper.unmount();
    },
  );

  it("withdraws the old form immediately when the route changes during an AI refresh", async () => {
    const containerB = {
      ...container,
      id: "44444444-4444-4444-8444-444444444445",
      containerNumber: "TGHU1234567",
    };
    const taskB = nodeTask({
      id: "55555555-5555-4555-8555-555555555556",
      containerId: containerB.id,
      workOrders: [
        {
          id: "66666666-6666-4666-8666-666666666667",
          workOrderDefinitionKey: "stuffing",
          state: "available",
          assignmentState: "pool",
          assigneeId: null,
          dueAt: null,
          completedAt: null,
        },
      ],
      nextAction: {
        actionCode: "work_execution.claim_work_order",
        workOrderId: "66666666-6666-4666-8666-666666666667",
        workOrderDefinitionKey: "stuffing",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
      },
    });
    getSnapshot.mockResolvedValue(historicalSnapshot());
    const { wrapper, router } = await mountPageWithRouter();
    await wrapper
      .get('[aria-label="装箱结果表单"]')
      .findAll("input")[1]!
      .setValue("A-DRAFT");
    aiReceipt.value = claimReceipt();
    await nextTick();
    expect(wrapper.find('[aria-label="装箱工单领取回执"]').exists()).toBe(true);

    const refreshA = deferred<typeof container>();
    const loadB = deferred<typeof containerB>();
    getContainer.mockImplementation((id: string) =>
      id === container.id ? refreshA.promise : loadB.promise,
    );
    listNodeTasks.mockImplementation(
      async (query?: { containerId?: string }) => ({
        items: query?.containerId === containerB.id ? [taskB] : [nodeTask()],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
      }),
    );

    const refreshing = Promise.resolve(aiRefreshTask?.());
    await nextTick();
    await router.replace({
      path: "/workspaces/stuffing",
      query: { containerId: containerB.id, taskId: taskB.id },
    });
    await nextTick();

    expect(wrapper.find('[aria-label="装箱结果表单"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="装箱工单领取回执"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain("A-DRAFT");

    loadB.resolve(containerB);
    await flushPromises();
    refreshA.resolve(container);
    await refreshing;
    await flushPromises();

    expect(wrapper.get('[aria-label="装箱结果表单"]').text()).toContain(
      "保存更正版",
    );
    expect(
      wrapper.get('[aria-label="装箱结果表单"]').findAll("input")[1]!.element,
    ).not.toHaveProperty("value", "A-DRAFT");
  });

  it("keeps a formal AI claim receipt in work mode after claim advances the task", async () => {
    getSnapshot.mockResolvedValue(historicalSnapshot());
    const wrapper = await mountPage();
    const sealNumber = wrapper
      .get('[aria-label="装箱结果表单"]')
      .findAll("input")[1]!;
    await sealNumber.setValue("DIRTY-AFTER-CLAIM");
    await wrapper.get('[data-testid="mode-ai"]').trigger("click");
    aiReceipt.value = claimReceipt();
    await nextTick();
    listNodeTasks.mockResolvedValue({
      items: [
        nodeTask({
          state: "in_progress",
          workOrders: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              workOrderDefinitionKey: "stuffing",
              state: "in_progress",
              assignmentState: "assigned",
              assigneeId: "actor-1",
              dueAt: null,
              completedAt: null,
            },
          ],
          nextAction: {
            actionCode: "work_execution.complete_work_order",
            workOrderId: "66666666-6666-4666-8666-666666666666",
            workOrderDefinitionKey: "stuffing",
            assignmentState: "assigned",
            assigneeId: "actor-1",
            dueAt: null,
          },
        }),
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });

    await aiRefreshTask?.();
    await flushPromises();

    const context = wrapper.get('[data-testid="task-context-panel"]');
    expect(context.attributes("data-modes")).toBe("work,archive,collaboration");
    expect(context.attributes("data-active-mode")).toBe("work");
    expect(wrapper.get('[aria-label="装箱工单领取回执"]').text()).toContain(
      "WorkOrder 领取回执",
    );
    expect(wrapper.get('[aria-label="装箱工单领取回执"]').text()).toContain(
      "不代表装箱快照、VGM、实际装箱或生命周期进度",
    );
    expect(
      wrapper.get('[aria-label="装箱结果表单"]').findAll("input")[1]!.element,
    ).toHaveProperty("value", "DIRTY-AFTER-CLAIM");
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
    const { wrapper, router } = await mountPageWithRouter(
      `/workspaces/stuffing?containerId=${container.id}`,
    );

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
    expect(wrapper.find('[data-testid="task-context-panel"]').exists()).toBe(
      false,
    );
  });

  it("keeps professional stuffing work without task context capabilities", async () => {
    listNodeTasks.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    });
    const wrapper = await mountPage();
    const context = wrapper.get('[data-testid="task-context-panel"]');
    expect(context.attributes("data-modes")).toBe("work");
    expect(wrapper.find('[aria-label="装箱结果表单"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="archive-panel"]').exists()).toBe(false);
  });

  it("does not turn an explicit invalid task selection into snapshot history", async () => {
    getSnapshot.mockResolvedValue(historicalSnapshot());
    const { wrapper } = await mountPageWithRouter(
      `/workspaces/stuffing?containerId=${container.id}&taskId=missing-task`,
    );

    expect(
      wrapper.get('[data-testid="task-context-panel"]').attributes(),
    ).toMatchObject({ "data-modes": "work" });
    expect(wrapper.find('[aria-label="装箱结果表单"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("历史事实只读");
  });

  it("does not open a work session for a valid UUID that is not the exact container task", async () => {
    await mountPageWithRouter(
      `/workspaces/stuffing?containerId=${container.id}&taskId=aaaaaaaa-0000-4000-8000-000000000000`,
    );

    expect(openWorkSession).not.toHaveBeenCalled();
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

async function mountPageWithRouter(
  path = "/workspaces/stuffing?containerId=44444444-4444-4444-8444-444444444444&taskId=55555555-5555-4555-8555-555555555555",
  attachToDocument = false,
  realContextPanel = false,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/stuffing", component: StuffingWorkbench }],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(StuffingWorkbench, {
    ...(attachToDocument ? { attachTo: document.body } : {}),
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title"],
          template:
            "<header><h1>{{ title }}</h1><slot name='actions' /></header>",
        },
        TaskContextPanel: realContextPanel ? false : ContextPanelStub,
        ...(realContextPanel
          ? {
              TaskCollaborationPanel: true,
              TaskAiAssistancePanel: true,
            }
          : {}),
        TaskArchivePanel: {
          props: ["containerId", "taskId", "outcome"],
          template:
            '<section data-testid="archive-panel" :data-container-id="containerId" :data-task-id="taskId">档案</section>',
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

function claimReceipt(): TaskActionClaimWorkOrderResultV1 {
  return {
    workOrderId: "66666666-6666-4666-8666-666666666666",
    workOrderState: "in_progress",
    assignmentState: "assigned",
    assigneeId: "actor-1",
    taskId: "55555555-5555-4555-8555-555555555555",
    taskState: "in_progress",
    applied: true,
    clientOperationId: "operation-1",
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function activeContextMode(
  wrapper: Awaited<ReturnType<typeof mountPageWithRouter>>["wrapper"],
): string | undefined {
  return wrapper
    .get('[data-testid="task-context-panel"]')
    .attributes("data-active-mode");
}

function taskPage(items: ReturnType<typeof nodeTask>[]) {
  return {
    items,
    pageInfo: {
      nextCursor: null,
      hasNextPage: false as const,
      pageSize: 100,
    },
  };
}

function nodeTask(overrides: Record<string, unknown> = {}) {
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
    workOrders: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        workOrderDefinitionKey: "stuffing",
        state: "available",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
        completedAt: null,
      },
    ],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: "66666666-6666-4666-8666-666666666666",
      workOrderDefinitionKey: "stuffing",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
    ...overrides,
  };
}

function sessionWithPointer(contextMode: string) {
  return {
    contractVersion: "work-session.v1",
    sessionId: "77777777-7777-4777-8777-777777777777",
    version: 1,
    status: "current",
    workbenchCode: "stuffing",
    contextKey: `stuffing|container:${container.id}|task:55555555-5555-4555-8555-555555555555`,
    routeContext: {
      kind: "stuffing.v1",
      containerId: container.id,
      taskId: "55555555-5555-4555-8555-555555555555",
    },
    subjectRef: { kind: "container", id: container.id },
    taskRef: {
      kind: "node_task",
      id: "55555555-5555-4555-8555-555555555555",
    },
    draftRef: null,
    domainVersionSeen: 0,
    activeItemKey: "stuffing-snapshot",
    contextMode,
    displaySummary: "装箱 · KOCU4960726",
    lastOpenedAt: "2026-10-14T08:00:00.000Z",
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
  };
}
