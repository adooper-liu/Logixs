import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { HttpRequestError } from "../api/httpClient";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import PickupActionPanel from "../components/pickup/PickupActionPanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import WorkbenchLayout from "../components/workbench/WorkbenchLayout.vue";
import PickupWorkbench from "./PickupWorkbench.vue";
import TaskContextPanel from "../components/task/TaskContextPanel.vue";
import TaskArchivePanel from "../components/task/TaskArchivePanel.vue";

const listContainers = vi.fn();
const getContainer = vi.fn();
const listNodes = vi.fn();
const listTasks = vi.fn();
const listDates = vi.fn();
const claimWorkOrder = vi.fn();
const completeWorkOrder = vi.fn();
const recordDateFact = vi.fn();
const generateCandidate = vi.fn();
const getCandidate = vi.fn();
const confirmCandidate = vi.fn();
const rejectCandidate = vi.fn();
const listCollaboration = vi.fn();
const listActivities = vi.fn();
const cleanups: (() => void)[] = [];

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
vi.mock("../api/evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/evidence")>()),
  registerAndVerifyFloorEvidence: vi.fn(
    async (_container: string, input: string) => input,
  ),
}));
vi.mock("../api/taskAiAssistance", () => ({
  generateTaskActionCandidate: (...args: unknown[]) =>
    generateCandidate(...args),
  getTaskActionCandidate: (...args: unknown[]) => getCandidate(...args),
  confirmTaskActionCandidate: (...args: unknown[]) => confirmCandidate(...args),
  rejectTaskActionCandidate: (...args: unknown[]) => rejectCandidate(...args),
}));
vi.mock("../api/taskCollaboration", () => ({
  listTaskCollaboration: (...args: unknown[]) => listCollaboration(...args),
  postTaskCollaborationMessage: vi.fn(),
}));
vi.mock("../api/objectActivities", () => ({
  listObjectActivities: (...args: unknown[]) => listActivities(...args),
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
      claimWorkOrder,
      completeWorkOrder,
      recordDateFact,
      generateCandidate,
      getCandidate,
      confirmCandidate,
      rejectCandidate,
      listCollaboration,
      listActivities,
    ])
      mock.mockReset();
    listCollaboration.mockResolvedValue({
      messages: [],
      asOf: null,
      nextCursor: null,
      canPost: false,
      visibilityLabel: "当前任务",
      mentionOptions: [],
      evidenceOptions: [],
    });
    listActivities.mockResolvedValue({
      items: [],
      nextActions: [],
      pageInfo: { hasNextPage: false },
      projectionVersion: 1,
    });
    listContainers.mockResolvedValue({ items: [container] });
    getContainer.mockResolvedValue(container);
    listNodes.mockResolvedValue({ nodes: [] });
    listTasks.mockResolvedValue({ items: [task()] });
    listDates.mockResolvedValue({
      items: [],
      projectionVersion: 0,
      asOf: "2026-09-21T00:00:00Z",
    });
    claimWorkOrder.mockResolvedValue({
      commitState: "committed",
      workOrderState: "in_progress",
    });
    completeWorkOrder.mockResolvedValue({
      commitState: "committed",
      workOrderState: "completed",
      lifecycleApply: "not_applicable",
    });
  });
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

  it("shows the pickup role flow and separates availability, passage and work completion", async () => {
    const wrapper = await mountPage();
    const frame = wrapper.getComponent(RoleWorkbenchFrame);
    const layout = wrapper.getComponent(WorkbenchLayout);

    expect(frame.props("responsiveMode")).toBe("standard");
    expect(layout.props("responsiveMode")).toBe("standard");
    expect(
      wrapper
        .findAll("[data-workbench-pane]")
        .map((pane) => pane.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
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
    expect(wrapper.text()).not.toContain("AI 协作");
    expect(wrapper.get(".workbench-layout__mobile-nav").text()).toBe(
      "队列详情办理",
    );
  });

  it.each([
    { name: "missing task", taskId: "missing", candidate: task() },
    {
      name: "wrong node",
      taskId: "task-1",
      candidate: task({ nodeCode: "container_stuffing" }),
    },
    {
      name: "wrong container",
      taskId: "task-1",
      candidate: task({ containerId: "container-2" }),
    },
    {
      name: "null container",
      taskId: "task-1",
      candidate: task({ containerId: null }),
    },
    ...[
      "work_execution.claim_work_order",
      "work_execution.complete_work_order",
    ].flatMap((actionCode) => [
      {
        name: `missing WorkOrder for ${actionCode}`,
        taskId: "task-1",
        candidate: task({
          workOrders: [],
          nextAction: { ...task().nextAction!, actionCode },
        }),
      },
      {
        name: `mismatched WorkOrder for ${actionCode}`,
        taskId: "task-1",
        candidate: task({
          nextAction: {
            ...task().nextAction!,
            actionCode,
            workOrderId: "foreign-work",
          },
        }),
      },
    ]),
    {
      name: "unknown action",
      taskId: "task-1",
      candidate: task({
        nextAction: { ...task().nextAction!, actionCode: "unsupported.action" },
      }),
    },
  ])(
    "fails closed for $name while keeping professional fact entry",
    async ({ candidate, taskId }) => {
      listTasks.mockResolvedValue({ items: [candidate] });
      const wrapper = await mountPage(
        `containerId=container-1&taskId=${taskId}`,
      );
      const panel = wrapper.getComponent(PickupActionPanel);
      expect(panel.props("task")).toBeNull();
      expect(wrapper.find(".task-action button").exists()).toBe(false);
      // Exercise the consumer's event boundary even when no action button exists.
      panel.vm.$emit("executeTask");
      await flushPromises();
      expect(claimWorkOrder).not.toHaveBeenCalled();
      expect(completeWorkOrder).not.toHaveBeenCalled();
      expect(wrapper.find('[aria-label="码头可提事实"] button').exists()).toBe(
        true,
      );
      expect(wrapper.find('[aria-label="重柜出场事实"] button').exists()).toBe(
        true,
      );
    },
  );

  it.each([0, 1, 2])(
    "does not invent an action with %s WorkOrders and no nextAction",
    async (count) => {
      listTasks.mockResolvedValue({
        items: [
          task({
            nextAction: null,
            state: "completed",
            workOrders: Array.from({ length: count }, (_, i) => ({
              ...task().workOrders[0]!,
              id: `work-${i}`,
            })),
          }),
        ],
      });
      const wrapper = await mountPage();
      const panel = wrapper.getComponent(PickupActionPanel);
      if (count === 1) expect(panel.props("task")?.nextAction).toBeNull();
      else expect(panel.props("task")).toBeNull();
      panel.vm.$emit("executeTask");
      await flushPromises();
      expect(wrapper.find(".task-action button").exists()).toBe(false);
      expect(claimWorkOrder).not.toHaveBeenCalled();
      expect(completeWorkOrder).not.toHaveBeenCalled();
      expect(panel.props("gateOutFact")).toBeNull();
    },
  );

  it.each([
    {
      actionCode: "work_execution.claim_work_order",
      label: "领取提柜任务",
      api: claimWorkOrder,
    },
    {
      actionCode: "work_execution.complete_work_order",
      label: "完成提柜工单",
      api: completeWorkOrder,
    },
  ])(
    "executes only the precise WorkOrder for $actionCode",
    async ({ actionCode, label, api }) => {
      const expected = task({
        nextAction: {
          ...task().nextAction!,
          actionCode,
          workOrderId: "work-exact",
        },
        workOrders: [
          ...task().workOrders,
          { ...task().workOrders[0]!, id: "work-exact" },
        ],
      });
      listTasks.mockResolvedValue({ items: [expected] });
      const wrapper = await mountPage("containerId=container-1&taskId=task-1");
      expect(wrapper.getComponent(PickupActionPanel).props("task")).toEqual(
        expected,
      );
      expect(wrapper.get(".task-action button").text()).toBe(label);
      await wrapper.get(".task-action button").trigger("click");
      await flushPromises();
      expect(api).toHaveBeenCalledTimes(1);
      expect(api).toHaveBeenCalledWith(
        "work-exact",
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      );
      expect(
        actionCode === "work_execution.claim_work_order"
          ? completeWorkOrder
          : claimWorkOrder,
      ).not.toHaveBeenCalled();
      expect(
        wrapper.getComponent(PickupActionPanel).props("gateOutFact"),
      ).toBeNull();
      expect(wrapper.get('[aria-label="重柜出场事实"] button').text()).toBe(
        "提交 Gate Out 复核",
      );
    },
  );

  it("keeps independent professional submissions available for an invalid task", async () => {
    recordDateFact.mockResolvedValue(savedReceipt);
    const wrapper = await mountPage("containerId=container-1&taskId=missing");
    const panel = wrapper.getComponent(PickupActionPanel);
    const draft = {
      kind: "available",
      localDateTime: "2026-09-21T09:00",
      evidenceInputs: ["44444444-4444-4444-8444-444444444444"],
      location: {
        locationType: "terminal",
        unlocode: "USLAX",
        timezone: "America/Los_Angeles",
      },
    };
    panel.vm.$emit("submit", draft);
    await flushPromises();
    expect(recordDateFact).toHaveBeenCalledWith(
      "container-1",
      expect.objectContaining({ eventCode: "available" }),
    );
    expect(claimWorkOrder).not.toHaveBeenCalled();
    expect(completeWorkOrder).not.toHaveBeenCalled();
  });

  it("rebinds taskId within the same component without falling back", async () => {
    const second = task({
      id: "task-2",
      nextAction: { ...task().nextAction!, workOrderId: "work-2" },
      workOrders: [{ ...task().workOrders[0]!, id: "work-2" }],
    });
    listTasks.mockResolvedValue({ items: [task(), second] });
    const { wrapper, router } = await mountPageWithRouter();
    const instance = wrapper.vm.$;
    await router.replace(
      "/workspaces/pickup?containerId=container-1&taskId=task-2",
    );
    expect(wrapper.vm.$).toBe(instance);
    expect(wrapper.getComponent(PickupActionPanel).props("task")?.id).toBe(
      "task-2",
    );
    await wrapper.get(".task-action button").trigger("click");
    await flushPromises();
    expect(claimWorkOrder).toHaveBeenCalledWith("work-2", expect.any(Object));
    await router.replace(
      "/workspaces/pickup?containerId=container-1&taskId=missing",
    );
    expect(wrapper.getComponent(PickupActionPanel).props("task")).toBeNull();
    wrapper.getComponent(PickupActionPanel).vm.$emit("executeTask");
    await flushPromises();
    expect(claimWorkOrder).toHaveBeenCalledTimes(1);
  });

  it("never exposes A's late task response after switching the same component to B", async () => {
    const { wrapper, router } = await mountPageWithRouter();
    let releaseA!: (value: { items: NodeTaskDetail[] }) => void;
    const lateA = new Promise<{ items: NodeTaskDetail[] }>((resolve) => {
      releaseA = resolve;
    });
    const b = task({
      id: "task-b",
      containerId: "container-b",
      nextAction: { ...task().nextAction!, workOrderId: "work-b" },
      workOrders: [{ ...task().workOrders[0]!, id: "work-b" }],
    });
    getContainer.mockImplementation(async (id: string) => ({
      ...container,
      id,
    }));
    listTasks.mockImplementation((input?: { containerId?: string }) =>
      input?.containerId === "container-1"
        ? lateA
        : Promise.resolve({ items: [b] }),
    );
    // Committed claim starts a reload of A, then navigation starts B's selection.
    await wrapper.get(".task-action button").trigger("click");
    await flushPromises();
    await router.replace(
      "/workspaces/pickup?containerId=container-b&taskId=task-b",
    );
    expect(wrapper.find(".task-action button").exists()).toBe(false);
    expect(claimWorkOrder).toHaveBeenCalledTimes(1);
    await flushPromises();
    releaseA({ items: [task()] });
    await flushPromises();
    expect(wrapper.getComponent(PickupActionPanel).props("task")?.id).toBe(
      "task-b",
    );
    expect(
      wrapper.getComponent(RoleWorkbenchFrame).props("selectedContainer")?.id,
    ).toBe("container-b");
    expect(claimWorkOrder).toHaveBeenCalledTimes(1);
    await wrapper.get(".task-action button").trigger("click");
    await flushPromises();
    expect(
      claimWorkOrder.mock.calls.map(([workOrderId]) => workOrderId),
    ).toEqual(["work-1", "work-b"]);
  });

  it("keeps both drafts, instance, focus and scroll across same-container save/reload and uses the fresh version", async () => {
    const wrapper = await mountPage();
    await fillProfessional(wrapper);
    const panel = wrapper.getComponent(PickupActionPanel);
    const form = panel.element;
    const gate = wrapper.get('[aria-label="重柜出场事实"] textarea')
      .element as HTMLTextAreaElement;
    gate.focus();
    const scroll = wrapper.get('[data-workbench-pane="context"]').element;
    scroll.scrollTop = 100;
    const pending = deferred<{
      items: LifecycleDateFact[];
      projectionVersion: number;
    }>();
    listDates.mockImplementationOnce(() => pending.promise);
    recordDateFact.mockResolvedValue(savedReceipt);
    panel.vm.$emit("submit", availableDraft);
    await flushPromises();
    expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
    expect(document.activeElement).toBe(gate);
    expect(gate.value).toBe("gate-draft");
    expect(wrapper.text()).toContain("正在重读");
    panel.vm.$emit("submit", { ...availableDraft, kind: "gate_out" });
    panel.vm.$emit("executeTask");
    await flushPromises();
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(claimWorkOrder).not.toHaveBeenCalled();
    pending.resolve({
      items: [availableFactFixture("CNSHA")],
      projectionVersion: 7,
    });
    await flushPromises();
    expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
    expect(document.activeElement).toBe(gate);
    expect(scroll.scrollTop).toBe(100);
    expect(
      (wrapper.get('[aria-label="提柜地点"] input').element as HTMLInputElement)
        .value,
    ).toBe("USNYC");
    expect(gate.value).toBe("gate-draft");
    expect(panel.attributes("data-dirty")).toBe("true");
    expect(wrapper.get('[aria-label="提柜事实总览"]').text()).toContain(
      "待复核",
    );
    expect(
      wrapper.get(".task-action button").attributes("disabled"),
    ).toBeUndefined();
    await wrapper.get('[aria-label="重柜出场事实"] button').trigger("click");
    await flushPromises();
    expect(recordDateFact).toHaveBeenLastCalledWith(
      "container-1",
      expect.objectContaining({
        eventCode: "gate_out",
        expectedVersion: 7,
        evidenceRefs: ["gate-draft"],
      }),
    );
  });

  it("keeps dirty form on reload failure, blocks stale-version writes and allows explicit recovery", async () => {
    const wrapper = await mountPage();
    await fillProfessional(wrapper);
    const form = wrapper.getComponent(PickupActionPanel).element;
    getContainer.mockRejectedValueOnce(new Error("reload failed"));
    recordDateFact.mockResolvedValue(savedReceipt);
    wrapper.getComponent(PickupActionPanel).vm.$emit("submit", availableDraft);
    await flushPromises();
    expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
    expect(wrapper.text()).toContain("货柜没能加载");
    wrapper.getComponent(PickupActionPanel).vm.$emit("submit", availableDraft);
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    await wrapper.get("[data-pickup-reload]").trigger("click");
    await flushPromises();
    expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
    expect(
      wrapper.get('[aria-label="重柜出场事实"] button').attributes("disabled"),
    ).toBeUndefined();
  });

  it("withdraws A through the real queue, starts B clean and ignores A's pending reload", async () => {
    const b = { ...container, id: "container-b", containerNumber: "B-CLEAN" };
    const taskB = task({ id: "task-b", containerId: b.id });
    listContainers.mockResolvedValue({ items: [container, b] });
    listTasks.mockImplementation(async (input?: { containerId?: string }) => ({
      items:
        input?.containerId === b.id
          ? [taskB]
          : input?.containerId
            ? [task()]
            : [task(), taskB],
    }));
    const { wrapper, router } = await mountPageWithRouter();
    await fillProfessional(wrapper);
    const instance = wrapper.vm.$;
    const lateA = deferred<{
      items: LifecycleDateFact[];
      projectionVersion: number;
    }>();
    listDates.mockImplementationOnce(() => lateA.promise);
    recordDateFact.mockResolvedValue(savedReceipt);
    wrapper.getComponent(PickupActionPanel).vm.$emit("submit", availableDraft);
    await flushPromises();
    const pendingB = deferred<typeof container>();
    getContainer.mockImplementationOnce(() => pendingB.promise);
    const oldPanel = wrapper.getComponent(PickupActionPanel);
    router.afterEach((to) => {
      if (to.query.containerId !== b.id) return;
      // Route identity has changed, while the prior child may still await render.
      oldPanel.vm.$emit("submit", availableDraft);
      oldPanel.vm.$emit("executeTask");
    });
    const button = wrapper
      .findAll('[aria-label="提柜任务列表"] button')
      .find((item) => item.text().includes("B-CLEAN"))!;
    await button.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query.containerId).toBe(b.id);
    expect(wrapper.vm.$).toBe(instance);
    expect(wrapper.findComponent(PickupActionPanel).exists()).toBe(false);
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(claimWorkOrder).not.toHaveBeenCalled();
    pendingB.resolve(b);
    await flushPromises();
    expect(
      wrapper
        .getComponent(PickupActionPanel)
        .findAll("textarea")
        .every((field) => !(field.element as HTMLTextAreaElement).value),
    ).toBe(true);
    expect(wrapper.text()).not.toContain("事实已保存");
    const reads = listDates.mock.calls.length;
    lateA.resolve({ items: [availableFactFixture()], projectionVersion: 9 });
    await flushPromises();
    expect(listDates).toHaveBeenCalledTimes(reads);
    expect(
      wrapper.getComponent(RoleWorkbenchFrame).props("selectedContainer")?.id,
    ).toBe(b.id);
    expect(wrapper.text()).not.toContain("事实已保存");
  });

  it.each(["success", "failure"] as const)(
    "isolates a late A command %s after real same-component A→B→A",
    async (outcome) => {
      getContainer.mockImplementation(async (id: string) => ({
        ...container,
        id,
      }));
      listTasks.mockResolvedValue({ items: [] });
      const { wrapper, router } = await mountPageWithRouter();
      await fillProfessional(wrapper);
      const pending = deferred<RecordLifecycleDateFactResult>();
      recordDateFact.mockImplementationOnce(() => pending.promise);
      wrapper
        .getComponent(PickupActionPanel)
        .vm.$emit("submit", availableDraft);
      await flushPromises();
      await router.replace("/workspaces/pickup?containerId=container-b");
      await flushPromises();
      await router.replace("/workspaces/pickup?containerId=container-1");
      await flushPromises();
      const reads = listDates.mock.calls.length;
      if (outcome === "success") pending.resolve(savedReceipt);
      else pending.reject(new Error("old A failure"));
      await flushPromises();
      expect(listDates).toHaveBeenCalledTimes(reads);
      expect(wrapper.text()).not.toContain("old A failure");
      expect(wrapper.text()).not.toContain("事实已保存");
      expect(
        wrapper
          .getComponent(PickupActionPanel)
          .findAll("textarea")
          .every((field) => !(field.element as HTMLTextAreaElement).value),
      ).toBe(true);
    },
  );
});

describe("Pickup exact task capabilities", () => {
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
  beforeEach(() => {
    vi.clearAllMocks();
    listNodes.mockResolvedValue({ nodes: [] });
    listDates.mockResolvedValue({ items: [], projectionVersion: 1 });
    listCollaboration.mockResolvedValue({
      messages: [],
      asOf: null,
      nextCursor: null,
      canPost: false,
      visibilityLabel: "当前任务",
      mentionOptions: [],
      evidenceOptions: [],
    });
    listActivities.mockResolvedValue({
      items: [],
      nextActions: [],
      pageInfo: { hasNextPage: false },
      projectionVersion: 1,
    });
  });

  it("opts into standard geometry, starts queue-first and advances through real pane controls", async () => {
    const { query } = setupContext();
    const { wrapper, router } = await mountPageWithRouter(query);
    const frame = wrapper.getComponent(RoleWorkbenchFrame);
    expect(frame.props("responsiveMode")).toBe("standard");
    expect(frame.props("mobileScreen")).toBe("queue");
    expect(wrapper.get('[data-testid="pickup-mobile-breadcrumb"]').text()).toBe(
      "KOCU4960726 · 提柜任务 · 办理",
    );
    const rail = wrapper.get('[data-testid="pickup-queue-rail"]');
    expect(rail.text()).toBe("提柜1 项");
    expect(rail.attributes("aria-label")).toBe(
      "当前货柜 KOCU4960726，1 项待办",
    );
    expect(rail.attributes("title")).toBe(rail.attributes("aria-label"));
    await wrapper.get('[aria-label="提柜任务列表"] button').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query.taskId).toBe(contextIds.task);
    expect(frame.props("mobileScreen")).toBe("detail");
    await wrapper.get('[data-mobile-target="context"]').trigger("click");
    expect(frame.props("mobileScreen")).toBe("context");
    await wrapper.get('[aria-label="折叠提柜办理"]').trigger("click");
    expect(wrapper.get('[data-testid="pickup-context-rail"]').text()).toBe(
      "继续办理",
    );
  });

  it("keeps both dirty drafts and AI mode across pane navigation without remounting", async () => {
    const { query } = setupContext();
    const wrapper = await mountPage(query);
    await fillProfessional(wrapper);
    const panel = wrapper.getComponent(PickupActionPanel);
    const form = panel.element;
    const fields = panel.findAll("input,textarea,select").map((f) => f.element);
    const values = fields.map((f) => (f as HTMLInputElement).value);
    await wrapper.get('[data-mode-control="ai"]').trigger("click");
    for (const screen of ["context", "queue", "detail", "context"]) {
      await wrapper.get(`[data-mobile-target="${screen}"]`).trigger("click");
      expect(
        wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen"),
      ).toBe(screen);
      expect(
        wrapper.findAll('[data-workbench-pane][data-mobile-active="true"]'),
      ).toHaveLength(1);
    }
    expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
    expect(panel.attributes("data-dirty")).toBe("true");
    expect(fields.map((f) => (f as HTMLInputElement).value)).toEqual(values);
    expect(
      wrapper.get('[data-mode-control="ai"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(
      wrapper.get('[data-testid="pickup-mobile-breadcrumb"]').text(),
    ).toContain("AI 辅助");
  });

  it("lets a newer pane restore keep focus while a same-container professional reload completes", async () => {
    const { query } = setupContext();
    const wrapper = await mountPage(query);
    await fillProfessional(wrapper);
    await wrapper.get('[data-mobile-target="context"]').trigger("click");
    const field = wrapper.get('[aria-label="重柜出场事实"] textarea')
      .element as HTMLElement;
    field.focus();
    const selection = deferred<{
      items: LifecycleDateFact[];
      projectionVersion: number;
    }>();
    listDates.mockImplementationOnce(() => selection.promise);
    recordDateFact.mockResolvedValueOnce(savedReceipt);
    wrapper.getComponent(PickupActionPanel).vm.$emit("submit", availableDraft);
    await flushPromises();
    await wrapper.get('[data-mobile-target="queue"]').trigger("click");
    const queueButton = wrapper.get('[aria-label="提柜任务列表"] button')
      .element as HTMLElement;
    queueButton.focus();
    const outer = wrapper.element.parentElement!;
    outer.scrollTop = 144;
    selection.resolve({
      items: [availableFactFixture()],
      projectionVersion: 2,
    });
    await flushPromises();
    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "queue",
    );
    expect(document.activeElement).toBe(queueButton);
    expect(outer.scrollTop).toBe(144);
    expect(
      wrapper.getComponent(PickupActionPanel).attributes("data-dirty"),
    ).toBe("true");
  });

  it.each(["none", "archive", "collaboration"])(
    "keeps newer panes separate from held-POST %s mode intent",
    async (choice) => {
      const media = vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaQueryList);
      cleanups.push(() => media.mockRestore());
      const { query } = setupContext();
      const wrapper = await mountPage(query);
      await fillProfessional(wrapper);
      await wrapper.get('[data-mobile-target="context"]').trigger("click");
      await wrapper.get('[data-mode-control="ai"]').trigger("click");
      await flushPromises();
      const post = deferred<unknown>();
      const selection = deferred<{
        items: LifecycleDateFact[];
        projectionVersion: number;
      }>();
      const queue = deferred<{ items: (typeof container)[] }>();
      confirmCandidate.mockImplementationOnce(() => post.promise);
      listDates.mockImplementationOnce(() => selection.promise);
      listContainers.mockImplementationOnce(() => queue.promise);
      await wrapper.get('[data-testid="ai-confirm"]').trigger("click");
      await wrapper.get('[data-mobile-target="detail"]').trigger("click");
      await wrapper.get('[data-mobile-target="context"]').trigger("click");
      if (choice !== "none")
        await wrapper.get(`[data-mode-control="${choice}"]`).trigger("click");
      post.reject(
        new HttpRequestError({
          kind: "http",
          status: 409,
          message: "CONFLICT",
        }),
      );
      await flushPromises();
      await wrapper.get('[data-mobile-target="queue"]').trigger("click");
      expect(wrapper.get(".pickup-context").attributes("inert")).toBeDefined();
      selection.resolve({ items: [], projectionVersion: 2 });
      await flushPromises();
      queue.resolve({ items: [] });
      await flushPromises();
      expect(
        wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen"),
      ).toBe("queue");
      expect(
        wrapper
          .get(`[data-mode-control="${choice === "none" ? "ai" : choice}"]`)
          .attributes("aria-pressed"),
      ).toBe("true");
      await wrapper.get('[data-mobile-target="context"]').trigger("click");
      expect(
        wrapper.get(".pickup-context").attributes("inert"),
      ).toBeUndefined();
      expect(recordDateFact).not.toHaveBeenCalled();
    },
  );

  it("uses one real panel, exact typed refs and preserves dirty form/focus/scroll through all modes", async () => {
    const { query } = setupContext();
    const wrapper = await mountPage(query);
    await fillProfessional(wrapper);
    const panel = wrapper.getComponent(PickupActionPanel);
    const instance = panel.vm.$;
    const fields = panel.findAll("input,textarea,select").map((f) => f.element);
    const values = fields.map((f) => (f as HTMLInputElement).value);
    const focused = panel.get('[aria-label="重柜出场事实"] textarea')
      .element as HTMLElement;
    focused.focus();
    const outer = wrapper.element.parentElement!;
    outer.scrollTop = 77;
    expect(wrapper.findAllComponents(TaskContextPanel)).toHaveLength(1);
    expect(wrapper.findAll("[data-mode-control]").map((b) => b.text())).toEqual(
      ["办理", "档案", "协作", "AI 辅助"],
    );
    for (const mode of ["archive", "collaboration", "ai", "work"]) {
      await wrapper.get(`[data-mode-control="${mode}"]`).trigger("click");
      await flushPromises();
    }
    expect(wrapper.getComponent(TaskArchivePanel).props()).toMatchObject({
      containerId: contextIds.container,
      taskId: contextIds.task,
    });
    expect(listCollaboration).toHaveBeenCalledWith(
      contextIds.task,
      expect.objectContaining({
        subjectRef: { kind: "container", id: contextIds.container },
      }),
      expect.any(AbortSignal),
    );
    expect(generateCandidate).toHaveBeenCalledWith(
      contextIds.task,
      expect.objectContaining({
        subjectRef: { kind: "container", id: contextIds.container },
        workRef: { kind: "node_task", id: contextIds.task },
      }),
      expect.any(AbortSignal),
    );
    expect(panel.vm.$).toBe(instance);
    expect(
      panel.findAll("input,textarea,select").map((f) => f.element),
    ).toEqual(fields);
    expect(fields.map((f) => (f as HTMLInputElement).value)).toEqual(values);
    expect(panel.attributes("data-dirty")).toBe("true");
    expect(document.activeElement).toBe(focused);
    expect(outer.scrollTop).toBe(77);
  });

  it.each(["none", "work", "archive", "collaboration"])(
    "refresh restores AI only without new real %s intent",
    async (choice) => {
      const { query } = setupContext();
      const wrapper = await mountPage(query);
      await fillProfessional(wrapper);
      const form = wrapper.getComponent(PickupActionPanel).element;
      await wrapper.get('[data-mode-control="ai"]').trigger("click");
      await flushPromises();
      const pending = deferred<{
        items: LifecycleDateFact[];
        projectionVersion: number;
      }>();
      const pendingQueue = deferred<{ items: (typeof container)[] }>();
      listDates.mockImplementationOnce(() => pending.promise);
      listContainers.mockImplementationOnce(() => pendingQueue.promise);
      wrapper.getComponent(TaskContextPanel).vm.$emit("confirmAi");
      await flushPromises();
      expect(
        wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
      ).toBe("true");
      if (choice === "work") {
        const before = wrapper
          .getComponent(TaskContextPanel)
          .emitted("update:modelValue")?.length;
        await wrapper.get('[data-mode-control="work"]').trigger("click");
        expect(
          wrapper.getComponent(TaskContextPanel).emitted("update:modelValue")
            ?.length,
        ).toBe(before);
      }
      pending.resolve({ items: [], projectionVersion: 2 });
      // Archive/collaboration become available when exact selection is restored,
      // before the awaiting refresh settles.
      if (choice === "archive" || choice === "collaboration") {
        await flushPromises();
        await wrapper.get(`[data-mode-control="${choice}"]`).trigger("click");
      }
      pendingQueue.resolve({ items: [] });
      await flushPromises();
      expect(
        wrapper
          .get(`[data-mode-control="${choice === "none" ? "ai" : choice}"]`)
          .attributes("aria-pressed"),
      ).toBe("true");
      expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
      expect(
        wrapper.getComponent(PickupActionPanel).attributes("data-dirty"),
      ).toBe("true");
      expect(recordDateFact).not.toHaveBeenCalled();
    },
  );

  it.each([
    { choices: [], unavailable: false, retry: false },
    { choices: ["work"], unavailable: false, retry: false },
    { choices: ["archive"], unavailable: false, retry: false },
    { choices: ["collaboration"], unavailable: false, retry: false },
    { choices: ["archive", "collaboration"], unavailable: false, retry: false },
    { choices: ["collaboration", "archive"], unavailable: false, retry: false },
    { choices: ["archive"], unavailable: true, retry: false },
    { choices: ["archive"], unavailable: false, retry: true },
  ])(
    "held confirmation POST preserves $choices (unavailable=$unavailable, retry=$retry)",
    async ({ choices, unavailable, retry }) => {
      const { query, currentTask } = setupContext();
      const wrapper = await mountPage(query);
      await fillProfessional(wrapper);
      const panel = wrapper.getComponent(PickupActionPanel);
      const form = panel.element;
      const fields = panel
        .findAll("input,textarea,select")
        .map((f) => f.element);
      const values = fields.map((f) => (f as HTMLInputElement).value);
      await wrapper.get('[data-mode-control="ai"]').trigger("click");
      await flushPromises();
      if (retry) {
        confirmCandidate.mockRejectedValueOnce(
          new Error("NETWORK_ERROR: retry"),
        );
        await wrapper.get('[data-testid="ai-confirm"]').trigger("click");
        await flushPromises();
      }
      const post = deferred<unknown>();
      const selection = deferred<{
        items: LifecycleDateFact[];
        projectionVersion: number;
      }>();
      const queue = deferred<{ items: (typeof container)[] }>();
      confirmCandidate.mockImplementationOnce(() => post.promise);
      listDates.mockImplementationOnce(() => selection.promise);
      listContainers.mockImplementationOnce(() => queue.promise);
      const reads = listDates.mock.calls.length;
      await wrapper
        .get(`[data-testid="${retry ? "ai-retry-confirm" : "ai-confirm"}"]`)
        .trigger("click");
      await flushPromises();
      expect(confirmCandidate).toHaveBeenCalledTimes(retry ? 2 : 1);
      for (const choice of choices)
        await wrapper.get(`[data-mode-control="${choice}"]`).trigger("click");
      expect(listDates).toHaveBeenCalledTimes(reads);
      if (unavailable)
        listTasks.mockResolvedValue({
          items: [{ ...currentTask, workOrders: [], nextAction: null }],
        });
      post.reject(
        new HttpRequestError({
          kind: "http",
          status: 409,
          message: "CONFLICT: stale claim",
        }),
      );
      await flushPromises();
      expect(listDates).toHaveBeenCalledTimes(reads + 1);
      expect(
        wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
      ).toBe("true");
      selection.resolve({ items: [], projectionVersion: 2 });
      await flushPromises();
      queue.resolve({ items: [] });
      await flushPromises();
      const expected = unavailable ? "work" : (choices.at(-1) ?? "ai");
      expect(
        wrapper
          .get(`[data-mode-control="${expected}"]`)
          .attributes("aria-pressed"),
      ).toBe("true");
      expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
      expect(panel.attributes("data-dirty")).toBe("true");
      expect(fields.map((f) => (f as HTMLInputElement).value)).toEqual(values);
      expect(recordDateFact).not.toHaveBeenCalled();
      expect(claimWorkOrder).not.toHaveBeenCalled();
      expect(completeWorkOrder).not.toHaveBeenCalled();
    },
  );

  it("advances claim to complete, removes AI and retains exact formal receipt and dirty draft", async () => {
    const { query, currentTask } = setupContext();
    const wrapper = await mountPage(query);
    await fillProfessional(wrapper);
    const instance = wrapper.getComponent(PickupActionPanel).vm.$;
    await wrapper.get('[data-mode-control="ai"]').trigger("click");
    await flushPromises();
    confirmCandidate.mockImplementationOnce(async () => {
      listTasks.mockResolvedValue({
        items: [
          {
            ...currentTask,
            nextAction: {
              ...currentTask.nextAction!,
              actionCode: "work_execution.complete_work_order",
            },
          },
        ],
      });
      return {
        candidate: contextCandidate("accepted"),
        claimWorkOrderResult: claimReceipt(),
        decision: null,
        idempotencyReplay: false,
      };
    });
    wrapper.getComponent(TaskContextPanel).vm.$emit("confirmAi");
    await flushPromises();
    expect(wrapper.find('[data-mode-control="ai"]').exists()).toBe(false);
    expect(
      wrapper.get('[data-mode-control="work"]').attributes("aria-pressed"),
    ).toBe("true");
    expect(wrapper.getComponent(RoleWorkbenchFrame).props("contextLabel")).toBe(
      "提柜办理",
    );
    expect(wrapper.get('[aria-label="提柜工单领取回执"]').text()).toContain(
      contextIds.work,
    );
    expect(wrapper.getComponent(PickupActionPanel).vm.$).toBe(instance);
    expect(
      wrapper.getComponent(PickupActionPanel).attributes("data-dirty"),
    ).toBe("true");
    expect(recordDateFact).not.toHaveBeenCalled();
    recordDateFact.mockResolvedValue(savedReceipt);
    wrapper.getComponent(PickupActionPanel).vm.$emit("submit", availableDraft);
    await flushPromises();
    expect(wrapper.get('[aria-label="提柜工单领取回执"]').text()).toContain(
      contextIds.work,
    );
  });

  it.each([
    "complete",
    "no-action",
    "ambiguous",
    "unknown",
    "mismatch",
    "non-uuid",
  ])("gates capabilities for %s", async (kind) => {
    const { query, currentTask } = setupContext();
    if (kind === "complete")
      currentTask.nextAction!.actionCode = "work_execution.complete_work_order";
    if (kind === "no-action" || kind === "ambiguous")
      currentTask.nextAction = null;
    if (kind === "ambiguous") currentTask.workOrders = [];
    if (kind === "unknown") currentTask.nextAction!.actionCode = "unknown";
    if (kind === "mismatch") currentTask.nextAction!.workOrderId = "foreign";
    if (kind === "non-uuid") currentTask.id = "task-1";
    listTasks.mockResolvedValue({ items: [currentTask] });
    const wrapper = await mountPage(
      kind === "non-uuid"
        ? `containerId=${contextIds.container}&taskId=task-1`
        : query,
    );
    const modes = wrapper
      .findAll("[data-mode-control]")
      .map((b) => b.attributes("data-mode-control"));
    expect(modes).toEqual(
      ["complete", "no-action", "non-uuid"].includes(kind)
        ? ["work", "archive", "collaboration"]
        : ["work"],
    );
    expect(generateCandidate).not.toHaveBeenCalled();
    if (["ambiguous", "unknown", "mismatch"].includes(kind))
      expect(listCollaboration).not.toHaveBeenCalled();
  });

  it("shows direct failure and retries the same exact WorkOrder/key; retry events fail closed during reload", async () => {
    const { query } = setupContext();
    claimWorkOrder
      .mockRejectedValueOnce(new Error("NETWORK_ERROR: retry me"))
      .mockResolvedValueOnce(claimReceipt());
    const wrapper = await mountPage(query);
    await wrapper.get(".task-action > button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="本次操作记录"]').text()).toContain(
      "retry me",
    );
    await wrapper
      .get('[aria-label="本次操作记录"] button.retry')
      .trigger("click");
    await flushPromises();
    expect(claimWorkOrder.mock.calls[0]).toEqual(claimWorkOrder.mock.calls[1]);
    expect(claimWorkOrder.mock.calls[0]![0]).toBe(contextIds.work);
    expect(recordDateFact).not.toHaveBeenCalled();
  });

  it("rejects execute/retry events while exact selection reload is pending", async () => {
    const { query } = setupContext();
    claimWorkOrder.mockRejectedValueOnce(new Error("NETWORK_ERROR: retry me"));
    const wrapper = await mountPage(query);
    const panel = wrapper.getComponent(PickupActionPanel);
    panel.vm.$emit("executeTask");
    await flushPromises();
    const pending = deferred<{
      items: LifecycleDateFact[];
      projectionVersion: number;
    }>();
    listDates.mockImplementationOnce(() => pending.promise);
    recordDateFact.mockResolvedValue(savedReceipt);
    panel.vm.$emit("submit", availableDraft);
    await flushPromises();
    panel.vm.$emit("retryTask");
    panel.vm.$emit("executeTask");
    expect(claimWorkOrder).toHaveBeenCalledTimes(1);
    pending.resolve({ items: [], projectionVersion: 2 });
    await flushPromises();
    claimWorkOrder.mockResolvedValueOnce(claimReceipt());
    panel.vm.$emit("retryTask");
    await flushPromises();
    expect(claimWorkOrder.mock.calls[0]).toEqual(claimWorkOrder.mock.calls[1]);
  });

  it.each(["task", "container"])(
    "isolates late AI, archive and messages on same-component %s switch",
    async (kind) => {
      const { query, currentTask, selected } = setupContext();
      const taskB = task({
        ...currentTask,
        id: "55555555-5555-4555-8555-555555555555",
        containerId:
          kind === "task"
            ? selected.id
            : "66666666-6666-4666-8666-666666666666",
        workOrders: [
          {
            ...currentTask.workOrders[0]!,
            id: "77777777-7777-4777-8777-777777777777",
          },
        ],
        nextAction: {
          ...currentTask.nextAction!,
          workOrderId: "77777777-7777-4777-8777-777777777777",
        },
      });
      listTasks.mockResolvedValue({ items: [currentTask, taskB] });
      const { wrapper, router } = await mountPageWithRouter(query);
      await fillProfessional(wrapper);
      const form = wrapper.getComponent(PickupActionPanel).element;
      const pendingConfirm = deferred<unknown>();
      confirmCandidate.mockImplementationOnce(() => pendingConfirm.promise);
      await wrapper.get('[data-mode-control="ai"]').trigger("click");
      await flushPromises();
      const aiPanel = wrapper.get("[data-task-ai-assistance-panel]");
      await aiPanel.get(".task-ai__reason input").setValue("unsent A reason");
      wrapper.getComponent(TaskContextPanel).vm.$emit("confirmAi");
      await flushPromises();
      const generationCount = generateCandidate.mock.calls.length;
      getContainer.mockResolvedValue({ ...selected, id: taskB.containerId! });
      await router.replace(
        `/workspaces/pickup?containerId=${taskB.containerId}&taskId=${taskB.id}`,
      );
      await flushPromises();
      const reads = listDates.mock.calls.length;
      pendingConfirm.resolve({
        candidate: contextCandidate("accepted"),
        claimWorkOrderResult: claimReceipt(),
        decision: null,
        idempotencyReplay: false,
      });
      await flushPromises();
      expect(listDates.mock.calls).toHaveLength(reads);
      expect(wrapper.find('[aria-label="提柜工单领取回执"]').exists()).toBe(
        false,
      );
      expect(generateCandidate).toHaveBeenCalledTimes(generationCount);
      if (kind === "task") {
        expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
        expect(
          wrapper.getComponent(PickupActionPanel).attributes("data-dirty"),
        ).toBe("true");
      } else
        expect(
          wrapper.getComponent(PickupActionPanel).attributes("data-dirty"),
        ).toBe("false");
      generateCandidate.mockResolvedValue({
        ...contextCandidate(),
        context: {
          subjectRef: { kind: "container", id: taskB.containerId },
          workRef: { kind: "node_task", id: taskB.id },
        },
        workOrderId: taskB.workOrders[0]!.id,
      });
      await wrapper.get('[data-mode-control="ai"]').trigger("click");
      await flushPromises();
      expect(
        (
          wrapper.get("[data-task-ai-assistance-panel] .task-ai__reason input")
            .element as HTMLTextAreaElement
        ).value,
      ).toBe("");
    },
  );
});

describe("Pickup late capability responses", () => {
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
  it("isolates pending archive, collaboration and generation on same-container task change", async () => {
    vi.clearAllMocks();
    listNodes.mockResolvedValue({ nodes: [] });
    listDates.mockResolvedValue({ items: [], projectionVersion: 1 });
    const { query, currentTask } = setupContext();
    const taskB = {
      ...currentTask,
      id: "55555555-5555-4555-8555-555555555555",
    };
    listTasks.mockResolvedValue({ items: [currentTask, taskB] });
    const archiveA = deferred<unknown>();
    const messagesA = deferred<unknown>();
    const candidateA = deferred<unknown>();
    listActivities
      .mockImplementationOnce(() => archiveA.promise)
      .mockResolvedValue({
        items: [],
        nextActions: [],
        pageInfo: { hasNextPage: false },
        projectionVersion: 2,
      });
    listCollaboration
      .mockImplementationOnce(() => messagesA.promise)
      .mockResolvedValue({
        messages: [],
        asOf: null,
        nextCursor: null,
        canPost: false,
        visibilityLabel: "当前任务",
        mentionOptions: [],
        evidenceOptions: [],
      });
    generateCandidate.mockImplementationOnce(() => candidateA.promise);
    const { wrapper, router } = await mountPageWithRouter(query);
    await fillProfessional(wrapper);
    const form = wrapper.getComponent(PickupActionPanel).element;
    await wrapper.get('[data-mode-control="ai"]').trigger("click");
    await router.replace(
      `/workspaces/pickup?containerId=${contextIds.container}&taskId=${taskB.id}`,
    );
    await flushPromises();
    const bCandidate = {
      ...contextCandidate(),
      title: "B current candidate",
      context: {
        subjectRef: { kind: "container", id: contextIds.container },
        workRef: { kind: "node_task", id: taskB.id },
      },
    };
    generateCandidate.mockResolvedValue(bCandidate);
    await wrapper.get('[data-mode-control="ai"]').trigger("click");
    await flushPromises();
    archiveA.resolve({
      items: [{ id: "old", taskId: currentTask.id, title: "A late archive" }],
      nextActions: [],
      pageInfo: { hasNextPage: false },
      projectionVersion: 1,
    });
    messagesA.resolve({
      messages: [{ messageId: "old", body: "A late message" }],
      nextCursor: null,
      canPost: false,
    });
    candidateA.resolve({ ...contextCandidate(), title: "A late candidate" });
    await flushPromises();
    expect(wrapper.text()).toContain("B current candidate");
    expect(wrapper.text()).not.toMatch(/A late (archive|message|candidate)/);
    expect(wrapper.getComponent(TaskArchivePanel).props("taskId")).toBe(
      taskB.id,
    );
    expect(wrapper.getComponent(PickupActionPanel).element).toBe(form);
    expect(
      wrapper.getComponent(PickupActionPanel).attributes("data-dirty"),
    ).toBe("true");
  });

  it("late direct claim cannot reload or release the new task's pending operation", async () => {
    vi.clearAllMocks();
    const { query, currentTask } = setupContext();
    const taskB = {
      ...currentTask,
      id: "55555555-5555-4555-8555-555555555555",
      workOrders: [
        {
          ...currentTask.workOrders[0]!,
          id: "77777777-7777-4777-8777-777777777777",
        },
      ],
      nextAction: {
        ...currentTask.nextAction!,
        workOrderId: "77777777-7777-4777-8777-777777777777",
      },
    };
    listTasks.mockResolvedValue({ items: [currentTask, taskB] });
    const pendingA = deferred<unknown>();
    const pendingB = deferred<unknown>();
    claimWorkOrder
      .mockImplementationOnce(() => pendingA.promise)
      .mockImplementationOnce(() => pendingB.promise);
    const { wrapper, router } = await mountPageWithRouter(query);
    wrapper.getComponent(PickupActionPanel).vm.$emit("executeTask");
    await flushPromises();
    await router.replace(
      `/workspaces/pickup?containerId=${contextIds.container}&taskId=${taskB.id}`,
    );
    await flushPromises();
    wrapper.getComponent(PickupActionPanel).vm.$emit("executeTask");
    await flushPromises();
    const reads = listDates.mock.calls.length;
    pendingA.resolve(claimReceipt());
    await flushPromises();
    expect(listDates.mock.calls).toHaveLength(reads);
    expect(
      wrapper.getComponent(PickupActionPanel).props("taskSubmitting"),
    ).toBe(true);
    pendingB.resolve({
      ...claimReceipt(),
      taskId: taskB.id,
      workOrderId: taskB.workOrders[0]!.id,
      clientOperationId: "new-B-operation",
    });
    await flushPromises();
    expect(listDates.mock.calls).toHaveLength(reads + 1);
    expect(
      wrapper.getComponent(PickupActionPanel).props("taskSubmitting"),
    ).toBe(false);
    expect(
      wrapper.getComponent(PickupActionPanel).props("submission")
        ?.clientOperationId,
    ).toBe("new-B-operation");
  });
});

const contextIds = {
  container: "11111111-1111-4111-8111-111111111111",
  task: "22222222-2222-4222-8222-222222222222",
  work: "33333333-3333-4333-8333-333333333333",
};
function contextCandidate(status = "proposed") {
  return {
    candidateId: "44444444-4444-4444-8444-444444444444",
    candidateHash: "synthetic-pickup-candidate",
    context: {
      subjectRef: { kind: "container", id: contextIds.container },
      workRef: { kind: "node_task", id: contextIds.task },
    },
    workOrderId: contextIds.work,
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: "建议领取当前提柜工单",
    rationale: "合成演练：领取建立工单责任。",
    impact: "不证明码头可提、Gate Out、计划或交接。",
    riskLevel: "low",
    warningCodes: [],
    status,
    source: {
      kind: "rule",
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: "synthetic-input",
      inputRefs: [],
      generatedAt: "2026-10-21T08:00:00.000Z",
    },
  };
}
function claimReceipt() {
  return {
    workOrderId: contextIds.work,
    taskId: contextIds.task,
    workOrderState: "in_progress",
    taskState: "in_progress",
    assignmentState: "assigned",
    assigneeId: contextIds.task,
    applied: true,
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    clientOperationId: "synthetic-operation",
    rejectionReasonCode: null,
  };
}
function setupContext() {
  listNodes.mockResolvedValue({ nodes: [] });
  listDates.mockResolvedValue({ items: [], projectionVersion: 1 });
  listCollaboration.mockResolvedValue({
    messages: [],
    asOf: null,
    nextCursor: null,
    canPost: false,
    visibilityLabel: "当前任务",
    mentionOptions: [],
    evidenceOptions: [],
  });
  listActivities.mockResolvedValue({
    items: [],
    nextActions: [],
    pageInfo: { hasNextPage: false },
    projectionVersion: 1,
  });
  const selected = { ...container, id: contextIds.container };
  const currentTask = task({
    id: contextIds.task,
    containerId: selected.id,
    workOrders: [{ ...task().workOrders[0]!, id: contextIds.work }],
    nextAction: { ...task().nextAction!, workOrderId: contextIds.work },
  });
  getContainer.mockResolvedValue(selected);
  listContainers.mockResolvedValue({ items: [selected] });
  listTasks.mockResolvedValue({ items: [currentTask] });
  generateCandidate.mockResolvedValue(contextCandidate());
  getCandidate.mockResolvedValue(contextCandidate());
  confirmCandidate.mockResolvedValue({
    candidate: contextCandidate("accepted"),
    claimWorkOrderResult: claimReceipt(),
    decision: null,
    idempotencyReplay: false,
  });
  return {
    selected,
    currentTask,
    query: `containerId=${selected.id}&taskId=${currentTask.id}`,
  };
}

const availableDraft = {
  kind: "available" as const,
  localDateTime: "2026-09-21T09:00",
  evidenceInputs: ["available-draft"],
  location: {
    locationType: "terminal" as const,
    unlocode: "USNYC",
    timezone: "America/New_York",
  },
};
const savedReceipt: RecordLifecycleDateFactResult = {
  factId: "available-fact",
  recordState: "recorded",
  applicationState: "review_required",
  reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
  canonicalEventId: null,
  projectionVersion: 7,
};
function availableFactFixture(unlocode = "USLAX"): LifecycleDateFact {
  return {
    factId: "available-fact",
    nodeCode: "container_pickup",
    eventCode: "available",
    timeKind: "actual",
    occurredAt: "2026-09-21T13:00:00Z",
    rawValue: "2026-09-21T09:00",
    sourceUtcOffset: "-04:00",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix.manual",
    authoritySystem: "terminal-operator",
    verificationState: "pending",
    confidenceState: "unknown",
    validity: "effective",
    authorityPolicyRef: null,
    location: {
      locationType: "terminal",
      unlocode,
      timezone: "America/Los_Angeles",
    },
    evidenceRefs: [],
    applicationState: "review_required",
    applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
    canonicalEventId: null,
    projectionVersion: 7,
    recordedAt: "2026-09-21T13:00:00Z",
  };
}
async function fillProfessional(
  wrapper: Awaited<ReturnType<typeof mountPage>>,
) {
  const inputs = wrapper.get('[aria-label="提柜地点"]').findAll("input");
  await inputs[0]!.setValue("USNYC");
  await inputs[2]!.setValue("America/New_York");
  await wrapper
    .get('[aria-label="码头可提事实"] input')
    .setValue("2026-09-21T09:00");
  await wrapper
    .get('[aria-label="码头可提事实"] textarea')
    .setValue("available-draft");
  await wrapper
    .get('[aria-label="重柜出场事实"] input')
    .setValue("2026-09-21T10:00");
  await wrapper
    .get('[aria-label="重柜出场事实"] textarea')
    .setValue("gate-draft");
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function mountPage(query = "containerId=container-1") {
  return (await mountPageWithRouter(query)).wrapper;
}

async function mountPageWithRouter(query = "containerId=container-1") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/workspaces/pickup", component: PickupWorkbench }],
  });
  await router.push(`/workspaces/pickup?${query}`);
  await router.isReady();
  const wrapper = mount(PickupWorkbench, {
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
  cleanups.push(() => wrapper.unmount());
  await flushPromises();
  return { wrapper, router };
}

function task(overrides: Partial<NodeTaskDetail> = {}): NodeTaskDetail {
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
    workOrders: [
      {
        id: "work-1",
        workOrderDefinitionKey: "pickup",
        state: "ready",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
        completedAt: null,
      },
    ],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.claim_work_order",
      workOrderId: "work-1",
      workOrderDefinitionKey: "pickup",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
    ...overrides,
  };
}
