import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type {
  TaskCollaborationMessageV1,
  TaskCollaborationPageV1,
  TaskCollaborationPostResultV1,
} from "@logix/contracts";
import { nextTick, toRaw } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";
import CustomsWorkbench from "./CustomsWorkbench.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
const getCase = vi.fn();
const listDates = vi.fn();
const listTaskCollaboration = vi.fn();
const postTaskCollaborationMessage = vi.fn();
const collaborationComposable = vi.hoisted(() => ({ calls: 0 }));

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
vi.mock("../api/taskCollaboration", () => ({
  listTaskCollaboration: (...args: unknown[]) => listTaskCollaboration(...args),
  postTaskCollaborationMessage: (...args: unknown[]) =>
    postTaskCollaborationMessage(...args),
}));
vi.mock("../composables/useTaskCollaboration", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../composables/useTaskCollaboration")
    >();
  return {
    ...actual,
    useTaskCollaboration: (
      context: Parameters<typeof actual.useTaskCollaboration>[0],
    ) => {
      collaborationComposable.calls += 1;
      return actual.useTaskCollaboration(context);
    },
  };
});
vi.mock("../components/task/TaskArchivePanel.vue", () => ({
  default: {
    name: "TaskArchivePanel",
    props: ["containerId", "taskId", "outcome"],
    template:
      '<section data-testid="task-archive">当前可见任务档案 {{ containerId }} {{ taskId }}</section>',
  },
}));

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "at_port",
  updatedAt: "2026-09-21T00:00:00Z",
};
const secondContainer = {
  ...container,
  id: "container-2",
  orderNumber: "26DSS00034",
  containerNumber: "KOCU4960727",
};
const mountedWrappers: VueWrapper[] = [];

const outcome = {
  id: "outcome-1",
  previousState: "in_progress",
  nextState: "completed",
  resultPolicyMode: "all_required_work_orders_completed",
  eventCode: null,
  requiredWorkOrderIds: ["work-1"],
  completedWorkOrderIds: ["work-1"],
  evaluatedAt: "2026-10-17T03:04:05.000Z",
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
      listTaskCollaboration,
      postTaskCollaborationMessage,
    ])
      mock.mockReset();
    collaborationComposable.calls = 0;
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
    listTaskCollaboration.mockResolvedValue(collaborationPage());
    postTaskCollaborationMessage.mockResolvedValue({
      contractVersion: "task-collaboration-post-result.v1",
      message: collaborationMessage("posted-message", "已发送"),
      idempotencyReplay: false,
    } satisfies TaskCollaborationPostResultV1);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "99999999-9999-4999-8999-999999999999"),
    });
  });

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount();
  });

  it("shows the customs role flow and keeps work completion separate from passage", async () => {
    const { wrapper } = await mountPage();
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

  it("owns one shared collaboration model for the selected container and task", async () => {
    const { wrapper } = await mountPage();

    expect(wrapper.find('[aria-label="清关案件表单"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="task-archive"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-context-mode="archive"]').attributes(),
    ).toHaveProperty("hidden");
    const modeControl = wrapper.get('[aria-label="任务上下文模式"]');
    expect(
      modeControl.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(modeControl.get('[data-mode-control="archive"]').text()).toBe(
      "档案",
    );
    expect(modeControl.get('[data-mode-control="collaboration"]').text()).toBe(
      "协作",
    );
    expect(collaborationComposable.calls).toBe(1);
    expect(listTaskCollaboration).toHaveBeenCalledTimes(1);
    expect(listTaskCollaboration).toHaveBeenCalledWith(
      "task-1",
      {
        subjectRef: { kind: "container", id: "container-1" },
        pageSize: 25,
      },
      expect.any(AbortSignal),
    );
  });

  it("passes the current container, task, and original outcome to the archive", async () => {
    listTasks.mockResolvedValue({ items: [task({ outcome })] });
    const { wrapper } = await mountPage();

    await wrapper.get('[data-mode-control="archive"]').trigger("click");

    const archive = wrapper.getComponent(TaskArchivePanel);
    expect(archive.props("containerId")).toBe("container-1");
    expect(archive.props("taskId")).toBe("task-1");
    expect(toRaw(archive.props("outcome"))).toBe(outcome);
  });

  it("does not show an empty archive entry when no task is selected", async () => {
    listTasks.mockResolvedValue({ items: [] });
    const { wrapper } = await mountPage();

    const contextPane = wrapper.get('[data-workbench-pane="context"]');
    expect(contextPane.text()).toContain("清关办理");
    const modes = wrapper.get('[aria-label="任务上下文模式"]');
    expect(modes.findAll("button")).toHaveLength(1);
    expect(modes.get('[data-mode-control="work"]').text()).toBe("办理");
    expect(wrapper.find('[data-testid="task-archive"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="清关案件表单"]').exists()).toBe(true);
    expect(wrapper.get('[aria-label="当前清关上下文"]').text()).toContain(
      "当前任务：清关任务待选择",
    );
    expect(listTaskCollaboration).not.toHaveBeenCalled();
  });

  it("preserves work input, context scroll, and focus across archive and collaboration", async () => {
    const { wrapper } = await mountPage();
    const input = wrapper.get<HTMLInputElement>(
      '[aria-label="清关案件表单"] input',
    );
    const contextPane = wrapper.get('[data-workbench-pane="context"]');
    const scrollOwner = contextPane.get<HTMLElement>(
      ".workbench-pane__scroll--independent",
    );

    await input.setValue("CN");
    input.element.focus();
    await input.trigger("focusin");
    scrollOwner.element.scrollTop = 137;
    await wrapper.get('[data-mode-control="archive"]').trigger("pointerdown");
    await wrapper.get('[data-mode-control="archive"]').trigger("click");
    scrollOwner.element.scrollTop = 41;
    await wrapper
      .get('[data-mode-control="collaboration"]')
      .trigger("pointerdown");
    await wrapper.get('[data-mode-control="collaboration"]').trigger("click");
    scrollOwner.element.scrollTop = 0;
    await wrapper.get('[data-mode-control="work"]').trigger("click");
    await flushPromises();

    expect(input.element.value).toBe("CN");
    expect(scrollOwner.element.scrollTop).toBe(137);
    expect(document.activeElement).toBe(input.element);
  });

  it("keeps inactive shared modes mounted but hidden, inert, and outside the tab order", async () => {
    const { wrapper } = await mountPage();
    await wrapper.get('[data-mode-control="archive"]').trigger("click");

    const workPanel = wrapper.get('[data-context-mode="work"]');
    const collaborationPanel = wrapper.get(
      '[data-context-mode="collaboration"]',
    );
    expect(workPanel.find('[aria-label="清关案件表单"]').exists()).toBe(true);
    expect(workPanel.attributes()).toHaveProperty("hidden");
    expect(workPanel.attributes()).toHaveProperty("inert");
    expect(workPanel.attributes("aria-hidden")).toBe("true");
    expect(collaborationPanel.attributes()).toHaveProperty("hidden");
    expect(collaborationPanel.attributes()).toHaveProperty("inert");
    expect(collaborationPanel.attributes("aria-hidden")).toBe("true");
    expect(workPanel.get("input").attributes("tabindex")).toBe("-1");
  });

  it("replaces old archive props immediately when the selected task changes", async () => {
    const secondTask = task({ id: "task-2", outcome: null });
    listTasks.mockResolvedValue({ items: [task({ outcome }), secondTask] });
    const { wrapper, router } = await mountPage(
      "/workspaces/customs?containerId=container-1&taskId=task-1",
    );
    await wrapper.get('[data-mode-control="archive"]').trigger("click");
    expect(wrapper.getComponent(TaskArchivePanel).props("taskId")).toBe(
      "task-1",
    );

    await router.push(
      "/workspaces/customs?containerId=container-1&taskId=task-2",
    );
    await flushPromises();

    const archive = wrapper.getComponent(TaskArchivePanel);
    expect(archive.props("taskId")).toBe("task-2");
    expect(archive.props("outcome")).toBeNull();
    expect(wrapper.text()).not.toContain("task-1");
  });

  it("does not overstate collaboration or the bounded archive", async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.text()).not.toMatch(
      /聊天|助手|更多功能|完整清关案件历史|全局审计/,
    );
    expect(wrapper.text()).toContain(
      "完成工单只记录清关岗位工作，不等于海关放行或流程过站",
    );
  });

  it("shows a neutral customs context without internal identifiers", async () => {
    listNodes.mockResolvedValue({ nodes: [lifecycleNode()] });
    const { wrapper } = await mountPage();

    const context = wrapper.get('[aria-label="当前清关上下文"]');
    expect(context.text()).toContain("当前货柜：KOCU4960726");
    expect(context.text()).toContain("当前任务：清关任务");
    expect(context.text()).toContain("当前节点：07 清关");
    expect(context.text()).not.toContain("task-1");
    expect(context.text()).not.toContain("customs_clearance");
    expect(context.text()).not.toContain("flow-1");
    expect(context.text()).not.toContain("node-1");
  });

  it("restores the context empty state when no object is selected", async () => {
    const { wrapper } = await mountPage("/workspaces/customs");

    expect(wrapper.get('[data-workbench-pane="context"]').text()).toContain(
      "选择对象后显示动作。",
    );
    expect(wrapper.find('[aria-label="任务上下文模式"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="当前清关上下文"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="清关案件表单"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="task-archive"]').exists()).toBe(false);
  });

  it("keeps task and node unknown states independent", async () => {
    listNodes.mockResolvedValue({ nodes: [lifecycleNode()] });
    listTasks.mockResolvedValue({ items: [] });
    const missingTask = await mountPage();
    expect(
      missingTask.wrapper.get('[aria-label="当前清关上下文"]').text(),
    ).toContain("当前任务：清关任务待选择");
    expect(
      missingTask.wrapper.get('[aria-label="当前清关上下文"]').text(),
    ).toContain("当前节点：07 清关");

    listTasks.mockResolvedValue({ items: [task()] });
    listNodes.mockResolvedValue({ nodes: [] });
    const missingNode = await mountPage();
    expect(
      missingNode.wrapper.get('[aria-label="当前清关上下文"]').text(),
    ).toContain("当前任务：清关任务");
    expect(
      missingNode.wrapper.get('[aria-label="当前清关上下文"]').text(),
    ).toContain("当前节点：清关节点待加载");
  });

  it("updates the customs context when the route selects another object", async () => {
    getContainer.mockImplementation(async (id: string) =>
      id === secondContainer.id ? secondContainer : container,
    );
    listNodes.mockImplementation(async (id: string) => ({
      nodes: [lifecycleNode({ sequence: id === secondContainer.id ? 8 : 7 })],
    }));
    listTasks.mockImplementation(
      async (query: { containerId?: string } | undefined) => ({
        items:
          query?.containerId === secondContainer.id
            ? [task({ id: "task-2", containerId: secondContainer.id })]
            : [task()],
      }),
    );
    const { wrapper, router } = await mountPage();
    const context = wrapper.get('[aria-label="当前清关上下文"]');
    expect(context.text()).toContain(container.containerNumber);

    await router.push(
      "/workspaces/customs?containerId=container-2&taskId=task-2",
    );
    await flushPromises();
    await flushPromises();

    const updatedContext = wrapper.get('[aria-label="当前清关上下文"]');
    expect(updatedContext.text()).toContain(secondContainer.containerNumber);
    expect(updatedContext.text()).toContain("当前任务：清关任务");
    expect(updatedContext.text()).toContain("当前节点：08 清关");
    expect(updatedContext.text()).not.toContain(container.containerNumber);
  });

  it("uses server canPost and reason for a completed task without hiding history", async () => {
    listTasks.mockResolvedValue({ items: [task({ state: "completed" })] });
    listTaskCollaboration.mockResolvedValue(
      collaborationPage({
        canPost: false,
        postDisabledReason: "任务已完成，只能查看历史协作。",
        messages: [collaborationMessage("completed", "已完成任务的历史协作")],
      }),
    );
    const { wrapper } = await mountPage();

    await wrapper.get('[data-mode-control="collaboration"]').trigger("click");

    expect(wrapper.text()).toContain("已完成任务的历史协作");
    expect(wrapper.text()).toContain("任务已完成，只能查看历史协作。");
    expect(wrapper.find('[aria-label="协作消息"]').exists()).toBe(false);
  });

  it("clears the old collaboration and returns to work while late GET and POST settle", async () => {
    const oldPost = deferred<TaskCollaborationPostResultV1>();
    const newGet = deferred<TaskCollaborationPageV1>();
    listTaskCollaboration
      .mockResolvedValueOnce(
        collaborationPage({
          messages: [collaborationMessage("old", "旧任务消息")],
        }),
      )
      .mockReturnValueOnce(newGet.promise);
    postTaskCollaborationMessage.mockReturnValueOnce(oldPost.promise);
    getContainer.mockImplementation(async (id: string) =>
      id === secondContainer.id ? secondContainer : container,
    );
    listTasks.mockImplementation(
      async (query: { containerId?: string } | undefined) => ({
        items:
          query?.containerId === secondContainer.id
            ? [task({ id: "task-2", containerId: secondContainer.id })]
            : [task()],
      }),
    );
    const { wrapper, router } = await mountPage();
    await wrapper.get('[data-mode-control="collaboration"]').trigger("click");
    await wrapper.get('[aria-label="协作消息"]').setValue("旧任务待发送");
    await wrapper.get('[data-testid="collaboration-send"]').trigger("click");

    await router.push(
      "/workspaces/customs?containerId=container-2&taskId=task-2",
    );
    await nextTick();

    expect(wrapper.text()).not.toContain("旧任务消息");
    await flushPromises();
    expect(
      wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");

    newGet.resolve(
      collaborationPage({
        containerId: "container-2",
        taskId: "task-2",
        messages: [collaborationMessage("new", "新任务消息")],
      }),
    );
    oldPost.resolve({
      contractVersion: "task-collaboration-post-result.v1",
      message: collaborationMessage("late", "旧任务晚到发送结果"),
      idempotencyReplay: false,
    });
    await flushPromises();

    await wrapper.get('[data-mode-control="collaboration"]').trigger("click");
    expect(wrapper.text()).toContain("新任务消息");
    expect(wrapper.text()).not.toContain("旧任务晚到发送结果");
  });
});

async function mountPage(path = "/workspaces/customs?containerId=container-1") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/customs", component: CustomsWorkbench }],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(CustomsWorkbench, {
    attachTo: document.body,
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
  mountedWrappers.push(wrapper);
  await flushPromises();
  return { wrapper, router };
}

function task(
  options: {
    id?: string;
    containerId?: string;
    outcome?: typeof outcome | null;
    state?: "pending" | "completed";
  } = {},
) {
  return {
    id: options.id ?? "task-1",
    flowInstanceId: "flow-1",
    nodeInstanceId: "node-1",
    nodeCode: "customs_clearance",
    containerId: options.containerId ?? container.id,
    taskDefinitionKey: "node-customs_clearance",
    state: options.state ?? "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: options.outcome ?? null,
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

function collaborationPage(
  options: {
    containerId?: string;
    taskId?: string;
    messages?: TaskCollaborationMessageV1[];
    canPost?: boolean;
    postDisabledReason?: string | null;
  } = {},
): TaskCollaborationPageV1 {
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: {
      kind: "container",
      id: options.containerId ?? "container-1",
    },
    workRef: { kind: "node_task", id: options.taskId ?? "task-1" },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages: options.messages ?? [
      collaborationMessage("current", "当前任务协作消息"),
    ],
    asOf: "2026-10-18T08:30:00.000Z",
    pageSize: 25,
    nextCursor: null,
    canPost: options.canPost ?? true,
    postDisabledReason: options.postDisabledReason ?? null,
    mentionOptions: [],
    evidenceOptions: [],
  };
}

function collaborationMessage(
  id: string,
  body: string,
): TaskCollaborationMessageV1 {
  return {
    contractVersion: "task-collaboration-message.v1",
    messageId: uuidFor(id),
    threadId: "88888888-8888-4888-8888-888888888888",
    author: { kind: "actor", id: "customs-operator", displayName: "清关经办" },
    body,
    parentMessageId: null,
    mentions: [],
    evidenceRefs: [],
    sourceRefs: [],
    occurredAt: "2026-10-18T08:01:00.000Z",
    recordedAt: "2026-10-18T08:01:01.000Z",
  };
}

function uuidFor(value: string): string {
  let sum = 1;
  for (const char of value) sum = (sum * 31 + char.charCodeAt(0)) % 99999999;
  return `${String(sum).padStart(8, "0")}-7777-4777-8777-777777777777`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function lifecycleNode(options: { sequence?: number } = {}) {
  return {
    nodeInstanceId: "node-1",
    nodeCode: "customs_clearance",
    sequence: options.sequence ?? 7,
    state: "active",
    applicability: "required",
    completedAt: null,
    blockedReasonRefs: [],
    isCurrent: true,
    times: { plannedAt: null, estimatedAt: null, actualAt: null },
  };
}
