import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computed, nextTick, ref, shallowRef } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeTaskOutcome } from "../api/nodeTasks";
import type {
  TaskAiAssistanceContext,
  TaskAiAssistancePanelModel,
  TaskAiAssistanceState,
} from "../composables/useTaskAiAssistance";
import type {
  TaskCollaborationContext,
  TaskCollaborationPanelModel,
} from "../composables/useTaskCollaboration";
import {
  createContainerSeed,
  createTaskSeed,
  type TaskItem,
} from "../data/sample";
import { toLiveTask } from "../data/liveWorkspaceProjection";
import TaskWorkbench from "./TaskWorkbench.vue";

const tasks = ref<TaskItem[]>([]);
const activeTaskId = shallowRef("");
const activeTask = computed(() =>
  tasks.value.find((task) => task.taskId === activeTaskId.value),
);
const containers = createContainerSeed();
const activeContainer = computed(() =>
  containers.find(
    (container) =>
      container.containerRecordId === activeTask.value?.containerRecordId,
  ),
);
const activeTaskOutcome = shallowRef<NodeTaskOutcome | null>(null);
const workspaceLoading = shallowRef(false);
const workspaceError = shallowRef("");
const selectTask = vi.fn((taskId: string) => {
  activeTaskId.value = taskId;
});
const refreshTask = vi.fn().mockResolvedValue(undefined);
const collaborationModel = {
  send: vi.fn(),
  refresh: vi.fn(),
  retrySend: vi.fn(),
  loadMore: vi.fn(),
} as unknown as TaskCollaborationPanelModel;
const useTaskCollaboration = vi.fn((context: unknown) => {
  void context;
  return collaborationModel;
});
const aiState = {
  confirm: vi.fn(),
  reject: vi.fn(),
  retry: vi.fn(),
  refresh: vi.fn(),
} as unknown as TaskAiAssistanceState;
const useTaskAiAssistance = vi.fn(
  (context: unknown, options: { refreshTask(): Promise<void> | void }) => {
    void context;
    void options;
    return aiState;
  },
);

vi.mock("../composables/useTaskCollaboration", () => ({
  useTaskCollaboration: (context: unknown) => useTaskCollaboration(context),
}));
vi.mock("../composables/useTaskAiAssistance", () => ({
  useTaskAiAssistance: (
    context: unknown,
    options: { refreshTask(): Promise<void> | void },
  ) => useTaskAiAssistance(context, options),
}));

vi.mock("../composables/useTaskWorkspace", () => ({
  useTaskWorkspace: () => ({
    loading: workspaceLoading,
    loadingMore: ref(false),
    moreError: ref(""),
    hasMore: ref(false),
    error: workspaceError,
    tasks,
    activeTaskId,
    activeTask,
    activeContainer,
    activeTaskOutcome,
    activeSubmission: ref({ stage: "idle" }),
    canSubmit: ref(false),
    isSubmitting: ref(false),
    selectTask,
    claimTask: vi.fn(),
    acknowledgeInput: vi.fn(),
    verifyEvidence: vi.fn(),
    executeAction: vi.fn(),
    reportException: vi.fn(),
    retrySubmission: vi.fn(),
    loadMore: vi.fn(),
    refreshTask,
  }),
}));

const LayoutStub = {
  name: "WorkbenchLayout",
  props: ["mobileContextLabel", "rightRailLabel", "mobileScreen"],
  emits: ["update:mobileScreen"],
  template: `
    <main data-testid="layout" :data-mobile-context-label="mobileContextLabel" :data-right-rail-label="rightRailLabel" :data-mobile-screen="mobileScreen">
      <div data-region="header"><slot name="header" /></div>
      <div data-region="responsibility"><slot name="responsibility" /></div>
      <div data-region="decision"><slot name="decision" /></div>
      <div data-workbench-pane="queue" data-region="queue"><slot name="queue" /></div>
      <div data-workbench-pane="detail" data-region="detail"><slot name="detail" /></div>
      <div data-workbench-pane="context" data-region="context"><slot name="context" /></div>
    </main>
  `,
};

const PaneStub = {
  props: ["id", "title", "state"],
  template: `
    <section :data-testid="id" :data-pane-state="state.kind">
      <h2>{{ title }}</h2>
      <slot v-if="state.kind === 'ready'" />
      <p v-else>{{ state.message }}</p>
    </section>
  `,
};

const ContextPanelStub = {
  name: "TaskContextPanel",
  props: ["modelValue", "contextKey", "modes", "collaboration", "ai"],
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
  template: `
    <section
      data-testid="task-context-panel"
      :data-context-key="contextKey"
      :data-modes="modes.join(',')"
      :data-active-mode="modelValue"
      :data-has-collaboration="String(Boolean(collaboration))"
      :data-has-ai="String(Boolean(ai))"
    >
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
    </section>
  `,
};

async function mountWorkbench() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/tasks", component: TaskWorkbench }],
  });
  await router.push("/tasks");
  await router.isReady();
  const wrapper = mount(TaskWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: { template: "<header>我的任务</header>" },
        WorkbenchLayout: LayoutStub,
        WorkbenchPane: PaneStub,
        WorkbenchResponsibilityBand: {
          props: ["items"],
          template:
            '<section aria-label="责任上下文">{{ items.map((item) => `${item.label}:${item.state === "known" ? item.value : "未知"}`).join("|") }}</section>',
        },
        WorkbenchDecisionStrip: {
          props: ["conclusion"],
          template: "<section>{{ conclusion }}</section>",
        },
        TaskQueue: { template: "<section>任务队列</section>" },
        TaskExecutionPanel: {
          template: '<section data-testid="execution-panel">办理控件</section>',
        },
        TaskFrozenResultPanel: {
          props: ["task", "container", "outcome"],
          template:
            '<section data-testid="frozen-panel">冻结结果 {{ task.taskId }} {{ container.containerRecordId }} {{ outcome?.id }}</section>',
        },
        TaskArchivePanel: {
          props: ["containerId", "taskId", "outcome"],
          template:
            '<section data-testid="archive-panel">来源档案 {{ taskId }} {{ containerId }} {{ outcome?.id }}</section>',
        },
        TaskContextPanel: ContextPanelStub,
      },
    },
  });
  return { wrapper, router };
}

describe("TaskWorkbench", () => {
  beforeEach(() => {
    const seed = createTaskSeed().filter((task) => task.queueKind === "human");
    seed[0]!.status = "completed";
    tasks.value = seed;
    activeTaskId.value = seed[1]!.taskId;
    activeTaskOutcome.value = null;
    workspaceLoading.value = false;
    workspaceError.value = "";
    selectTask.mockClear();
    useTaskCollaboration.mockClear();
    useTaskAiAssistance.mockClear();
    refreshTask.mockClear();
    vi.mocked(collaborationModel.send).mockClear();
    vi.mocked(collaborationModel.refresh).mockClear();
    vi.mocked(collaborationModel.retrySend).mockClear();
    vi.mocked(collaborationModel.loadMore).mockClear();
    vi.mocked(aiState.confirm).mockClear();
    vi.mocked(aiState.reject).mockClear();
    vi.mocked(aiState.retry).mockClear();
    vi.mocked(aiState.refresh).mockClear();
  });

  it("keeps the six regions and three panes with one shared task context", async () => {
    const { wrapper } = await mountWorkbench();

    expect(
      wrapper
        .findAll("[data-region]")
        .map((node) => node.attributes("data-region")),
    ).toEqual([
      "header",
      "responsibility",
      "decision",
      "queue",
      "detail",
      "context",
    ]);
    expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
    expect(wrapper.get('[data-testid="layout"]').attributes()).toMatchObject({
      "data-mobile-context-label": "上下文",
      "data-right-rail-label": "任务上下文",
    });
    expect(wrapper.get('[aria-label="责任上下文"]').text()).toMatch(
      /当前责任:|期限:/,
    );
    expect(wrapper.get('[data-testid="archive-panel"]').text()).toContain(
      "来源档案",
    );
    const context = wrapper.get('[data-testid="task-context-panel"]');
    expect(context.attributes()).toMatchObject({
      "data-context-key": `container:${activeContainer.value!.containerRecordId}|node_task:${activeTask.value!.taskId}`,
      "data-modes": "work,archive,collaboration,ai",
      "data-has-collaboration": "true",
      "data-has-ai": "true",
    });
    expect(useTaskCollaboration).toHaveBeenCalledTimes(1);
    expect(useTaskAiAssistance).toHaveBeenCalledTimes(1);
    const collaborationContext = useTaskCollaboration.mock
      .calls[0]![0] as unknown as Readonly<{
      value: TaskCollaborationContext | null;
    }>;
    expect(collaborationContext.value).toEqual({
      contextKey: `container:${activeContainer.value!.containerRecordId}|node_task:${activeTask.value!.taskId}`,
      taskId: activeTask.value!.taskId,
      subjectRef: {
        kind: "container",
        id: activeContainer.value!.containerRecordId,
      },
      workRef: { kind: "node_task", id: activeTask.value!.taskId },
    });
    const aiContext = useTaskAiAssistance.mock
      .calls[0]![0] as unknown as Readonly<{
      value: TaskAiAssistanceContext | null;
    }>;
    expect(aiContext.value).toEqual(collaborationContext.value);
    const ai = wrapper
      .getComponent({ name: "TaskContextPanel" })
      .props("ai") as TaskAiAssistancePanelModel;
    expect(ai.facts).toEqual({
      objectLabel: activeTask.value!.containerNumber,
      taskLabel: activeTask.value!.nodeName,
      actionLabel: "领取",
      responsibilityLabel: activeTask.value!.assignment.label,
      dueLabel: expect.any(String),
    });
    expect(wrapper.findAll('[data-testid="task-context-panel"]')).toHaveLength(
      1,
    );
    expect(wrapper.get('[data-testid="context-work"]').text()).toContain(
      activeTask.value!.nodeName,
    );
    await wrapper.get('[data-testid="context-submit"]').trigger("click");
    await wrapper.get('[data-testid="context-retry-thread"]').trigger("click");
    await wrapper.get('[data-testid="context-retry-send"]').trigger("click");
    await wrapper.get('[data-testid="context-load-more"]').trigger("click");
    expect(collaborationModel.send).toHaveBeenCalledTimes(1);
    expect(collaborationModel.refresh).toHaveBeenCalledTimes(1);
    expect(collaborationModel.retrySend).toHaveBeenCalledTimes(1);
    expect(collaborationModel.loadMore).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-testid="context-confirm-ai"]').trigger("click");
    await wrapper.get('[data-testid="context-reject-ai"]').trigger("click");
    await wrapper.get('[data-testid="context-retry-ai"]').trigger("click");
    await wrapper.get('[data-testid="context-refresh-ai"]').trigger("click");
    expect(aiState.confirm).toHaveBeenCalledTimes(1);
    expect(aiState.reject).toHaveBeenCalledWith("稍后处理");
    expect(aiState.retry).toHaveBeenCalledWith("confirm");
    expect(aiState.refresh).toHaveBeenCalledTimes(1);

    const options = useTaskAiAssistance.mock.calls[0]![1];
    await options.refreshTask();
    expect(refreshTask).toHaveBeenCalledTimes(1);
  });

  it("switches only the middle pane between execution and frozen result", async () => {
    const { wrapper } = await mountWorkbench();
    expect(wrapper.get('[data-testid="execution-panel"]').text()).toBe(
      "办理控件",
    );

    activeTaskId.value = tasks.value[0]!.taskId;
    activeTaskOutcome.value = {
      id: "outcome-1",
      previousState: "in_progress",
      nextState: "completed",
      resultPolicyMode: "all_required_work_orders_completed",
      eventCode: null,
      requiredWorkOrderIds: [],
      completedWorkOrderIds: [],
      evaluatedAt: "2026-10-17T03:04:05.000Z",
    };
    await nextTick();

    expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
    expect(wrapper.get('[data-testid="frozen-panel"]').text()).toContain(
      "冻结结果",
    );
    expect(wrapper.find('[data-testid="execution-panel"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[data-testid="archive-panel"]').text()).toContain(
      "来源档案",
    );
    expect(wrapper.text()).not.toMatch(
      /领取|完成工单|补证|异常上报|提交|同步中/,
    );
  });

  it("责任带不显示 opaque assignee，且保留完成未知与开放任务池语义", async () => {
    const container = containers[0]!;
    const completed = toLiveTask(
      {
        id: "task-completed",
        flowInstanceId: "flow-1",
        nodeInstanceId: "node-1",
        nodeCode: "customs_clearance",
        containerId: container.containerRecordId,
        taskDefinitionKey: "node-customs_clearance",
        state: "completed",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [],
        workOrders: [
          {
            id: "work-order-1",
            workOrderDefinitionKey: "wo-customs",
            state: "completed",
            assignmentState: "assigned",
            assigneeId: "historical-assignee",
            dueAt: null,
            completedAt: "2026-10-17T03:00:00.000Z",
          },
        ],
        outcome: null,
        nextAction: null,
      },
      {
        id: container.containerRecordId,
        containerNumber: container.containerNumber,
        orderNumber: container.orderNumber,
      },
    );
    const open = toLiveTask(
      {
        id: "task-open",
        flowInstanceId: "flow-1",
        nodeInstanceId: "node-2",
        nodeCode: "container_pickup",
        containerId: container.containerRecordId,
        taskDefinitionKey: "node-pickup",
        state: "pending",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "awaiting_evidence",
        conditionFactRefs: [],
        workOrders: [],
        outcome: null,
        nextAction: {
          actionCode: "work_execution.claim_work_order",
          workOrderId: "work-order-2",
          workOrderDefinitionKey: "wo-pickup",
          assignmentState: "pool",
          assigneeId: null,
          dueAt: null,
        },
      },
      {
        id: container.containerRecordId,
        containerNumber: container.containerNumber,
        orderNumber: container.orderNumber,
      },
    );
    const assigned = toLiveTask(
      {
        id: "task-assigned",
        flowInstanceId: "flow-1",
        nodeInstanceId: "node-3",
        nodeCode: "warehouse_delivery",
        containerId: container.containerRecordId,
        taskDefinitionKey: "node-delivery",
        state: "in_progress",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [],
        workOrders: [],
        outcome: null,
        nextAction: {
          actionCode: "work_execution.complete_work_order",
          workOrderId: "work-order-3",
          workOrderDefinitionKey: "wo-delivery",
          assignmentState: "assigned",
          assigneeId: "user-uuid",
          dueAt: null,
        },
      },
      {
        id: container.containerRecordId,
        containerNumber: container.containerNumber,
        orderNumber: container.orderNumber,
      },
    );
    tasks.value = [completed, open, assigned];
    activeTaskId.value = completed.taskId;
    const { wrapper } = await mountWorkbench();

    const responsibility = wrapper.get('[aria-label="责任上下文"]');
    expect(responsibility.text()).toContain("当前责任:未知");
    expect(responsibility.text()).not.toContain("已分配");
    expect(responsibility.text()).not.toContain("historical-assignee");

    activeTaskId.value = open.taskId;
    await nextTick();
    expect(responsibility.text()).toContain("当前责任:待领取");

    activeTaskId.value = assigned.taskId;
    await nextTick();
    expect(responsibility.text()).toContain("当前责任:进行中");
    expect(responsibility.text()).not.toContain("user-uuid");
  });

  it("切换对象后在新请求 pending 或失败时立即移除旧结果和档案", async () => {
    activeTaskId.value = tasks.value[0]!.taskId;
    activeTaskOutcome.value = {
      id: "outcome-container-a",
      previousState: "in_progress",
      nextState: "completed",
      resultPolicyMode: "all_required_work_orders_completed",
      eventCode: "customs_cleared",
      requiredWorkOrderIds: [],
      completedWorkOrderIds: [],
      evaluatedAt: "2026-10-17T03:04:05.000Z",
    };
    const oldTaskId = activeTask.value!.taskId;
    const oldContainerId = activeContainer.value!.containerRecordId;
    const { wrapper, router } = await mountWorkbench();

    expect(wrapper.get('[data-testid="frozen-panel"]').text()).toContain(
      oldTaskId,
    );
    expect(wrapper.get('[data-testid="archive-panel"]').text()).toContain(
      oldContainerId,
    );

    workspaceLoading.value = true;
    await router.replace("/tasks?containerId=container-b");
    await nextTick();

    expect(wrapper.find('[data-testid="frozen-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="archive-panel"]').exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="task-detail-pane"]').attributes(),
    ).toMatchObject({ "data-pane-state": "loading" });
    expect(
      wrapper.get('[data-testid="task-context-pane"]').attributes(),
    ).toMatchObject({ "data-pane-state": "loading" });
    expect(wrapper.find('[data-testid="task-context-panel"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain("outcome-container-a");

    workspaceLoading.value = false;
    workspaceError.value = "FORBIDDEN";
    await nextTick();

    expect(wrapper.find('[data-testid="frozen-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="archive-panel"]').exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="task-detail-pane"]').attributes(),
    ).toMatchObject({ "data-pane-state": "error" });
    expect(
      wrapper.get('[data-testid="task-context-pane"]').attributes(),
    ).toMatchObject({ "data-pane-state": "error" });
    expect(wrapper.find('[data-testid="task-context-panel"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain(oldTaskId);
    expect(wrapper.text()).not.toContain(oldContainerId);
  });

  it("derives collaboration refs from resolved entities instead of route input", async () => {
    const { router } = await mountWorkbench();
    await router.replace({
      path: "/tasks",
      query: {
        task: "untrusted-task",
        containerId: "untrusted-container",
      },
    });
    await nextTick();

    const collaborationContext = useTaskCollaboration.mock
      .calls[0]![0] as unknown as Readonly<{
      value: TaskCollaborationContext | null;
    }>;
    expect(collaborationContext.value).toMatchObject({
      taskId: activeTask.value!.taskId,
      subjectRef: { id: activeContainer.value!.containerRecordId },
    });
    expect(collaborationContext.value?.contextKey).not.toContain("untrusted");
    const aiContext = useTaskAiAssistance.mock
      .calls[0]![0] as unknown as Readonly<{
      value: TaskAiAssistanceContext | null;
    }>;
    expect(aiContext.value).toMatchObject({
      taskId: activeTask.value!.taskId,
      subjectRef: { id: activeContainer.value!.containerRecordId },
    });
    expect(aiContext.value?.contextKey).not.toContain("untrusted");
  });

  it("updates AI context synchronously on task switch and keeps AI available for completed tasks", async () => {
    const { wrapper } = await mountWorkbench();
    const aiContext = useTaskAiAssistance.mock
      .calls[0]![0] as unknown as Readonly<{
      value: TaskAiAssistanceContext | null;
    }>;
    const firstTaskId = aiContext.value!.taskId;

    activeTaskId.value = tasks.value[0]!.taskId;

    expect(aiContext.value?.taskId).toBe(tasks.value[0]!.taskId);
    expect(aiContext.value?.taskId).not.toBe(firstTaskId);
    await nextTick();
    const context = wrapper.get('[data-testid="task-context-panel"]');
    expect(context.attributes("data-modes")).toBe(
      "work,archive,collaboration,ai",
    );
    expect(context.attributes("data-has-ai")).toBe("true");
  });

  it("returns to AI after its own same-context task refresh", async () => {
    refreshTask.mockImplementationOnce(async () => {
      workspaceLoading.value = true;
      await nextTick();
      workspaceLoading.value = false;
      tasks.value = [...tasks.value];
      await nextTick();
    });
    const { wrapper } = await mountWorkbench();
    wrapper
      .getComponent({ name: "WorkbenchLayout" })
      .vm.$emit("update:mobileScreen", "context");
    const panel = wrapper.getComponent({ name: "TaskContextPanel" });
    panel.vm.$emit("update:modelValue", "ai");
    await nextTick();
    expect(
      wrapper
        .get('[data-testid="task-context-panel"]')
        .attributes("data-active-mode"),
    ).toBe("ai");

    const options = useTaskAiAssistance.mock.calls[0]![1];
    await options.refreshTask();
    await nextTick();

    expect(
      wrapper
        .get('[data-testid="task-context-panel"]')
        .attributes("data-active-mode"),
    ).toBe("ai");
    expect(
      wrapper.get('[data-testid="layout"]').attributes("data-mobile-screen"),
    ).toBe("context");
  });

  it("removes AI mode and model whenever exact task context is unavailable", async () => {
    const { wrapper } = await mountWorkbench();
    workspaceLoading.value = true;
    await nextTick();

    expect(wrapper.find('[data-testid="task-context-panel"]').exists()).toBe(
      false,
    );
    const aiContext = useTaskAiAssistance.mock
      .calls[0]![0] as unknown as Readonly<{
      value: TaskAiAssistanceContext | null;
    }>;
    expect(aiContext.value).toBeNull();
  });

  it("keeps AI transport and permission policy outside the consumer view", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/views/TaskWorkbench.vue"),
      "utf8",
    );

    expect(source).not.toContain("api/taskAiAssistance");
    expect(source).not.toContain("task.execute");
    expect(source).not.toMatch(/capabilit(?:y|ies)/i);
    expect(source).not.toMatch(/\brole\b/i);
  });
});
