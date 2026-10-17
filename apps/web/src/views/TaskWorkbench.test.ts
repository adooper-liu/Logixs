import { mount } from "@vue/test-utils";
import { computed, nextTick, ref, shallowRef } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeTaskOutcome } from "../api/nodeTasks";
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
  }),
}));

const LayoutStub = {
  props: ["mobileContextLabel"],
  template: `
    <main data-testid="layout" :data-mobile-context-label="mobileContextLabel">
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
  });

  it("keeps the six regions and three panes in causal order with archive mobile label", async () => {
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
      "data-mobile-context-label": "档案",
    });
    expect(wrapper.get('[aria-label="责任上下文"]').text()).toMatch(
      /当前责任:|期限:/,
    );
    expect(wrapper.get('[data-testid="archive-panel"]').text()).toContain(
      "来源档案",
    );
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
      wrapper.get('[data-testid="task-archive-pane"]').attributes(),
    ).toMatchObject({ "data-pane-state": "loading" });
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
      wrapper.get('[data-testid="task-archive-pane"]').attributes(),
    ).toMatchObject({ "data-pane-state": "error" });
    expect(wrapper.text()).not.toContain(oldTaskId);
    expect(wrapper.text()).not.toContain(oldContainerId);
  });
});
