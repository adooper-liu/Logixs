import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ReplaceWarehouseDeliveryInstructionCommand,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import type { NodeTaskDetail } from "../api/nodeTasks";
import { HttpRequestError } from "../api/httpClient";
import type {
  LifecycleDateFact,
  RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import DeliveryActionPanel from "../components/delivery/DeliveryActionPanel.vue";
import RoleWorkbenchFrame from "../components/workbench/RoleWorkbenchFrame.vue";
import WarehouseDeliveryWorkbench from "./WarehouseDeliveryWorkbench.vue";
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
const getInstruction = vi.fn();
const replaceInstruction = vi.fn();
vi.mock("../api/warehouseDelivery", () => ({
  getWarehouseDeliveryInstruction: (...args: unknown[]) =>
    getInstruction(...args),
  replaceWarehouseDeliveryInstruction: (...args: unknown[]) =>
    replaceInstruction(...args),
}));
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

const deliveryInstruction = {
  instructionId: "88888888-8888-4888-8888-888888888888",
  version: 1,
  warehouseLocationId: "99999999-9999-4999-8999-999999999999",
  warehouseName: "Local fixture warehouse",
  warehouseCode: "VLS",
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

describe("WarehouseDeliveryWorkbench", () => {
  it("opts into standard geometry and keeps direct URLs queue-first until real navigation", async () => {
    const { wrapper } = await mountPageWithRouter();
    expect(
      wrapper.getComponent(RoleWorkbenchFrame).props("responsiveMode"),
    ).toBe("standard");
    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "queue",
    );
    await wrapper.get('[data-mobile-target="context"]').trigger("click");
    expect(wrapper.getComponent(RoleWorkbenchFrame).props("mobileScreen")).toBe(
      "context",
    );
    expect(wrapper.get(".workbench-layout__mobile-nav").text()).toBe(
      "队列详情办理",
    );
  });
  beforeEach(() => {
    for (const mock of [
      getInstruction,
      replaceInstruction,
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
    getInstruction.mockImplementation(async (id: string) => ({
      ...deliveryInstruction,
      containerRecordId: id,
    }));
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

  it("shows the real delivery sequence and keeps work completion separate from passage", async () => {
    getInstruction.mockResolvedValue(null);
    const wrapper = await mountPage();
    expect(wrapper.get('[aria-label="送仓任务列表"]').text()).toContain(
      "领取送仓任务",
    );
    expect(wrapper.get('[aria-label="送仓事实总览"]').text()).toContain(
      "先锁定本柜本次目的仓",
    );
    expect(wrapper.get('[aria-label="目的仓指令"]').text()).toContain(
      "锁定目的仓",
    );
    expect(wrapper.get('[aria-label="送仓操作区"]').text()).toContain(
      "提交实际送仓复核",
    );
    expect(wrapper.text()).toContain(
      "工单完成只代表岗位作业完成；只有经采信且目的仓匹配的实际送仓事实才代表货柜到仓",
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
      const panel = wrapper.getComponent(DeliveryActionPanel);
      expect(panel.props("task")).toBeNull();
      expect(wrapper.find(".task-action button").exists()).toBe(false);
      // Exercise the consumer's event boundary even when no action button exists.
      panel.vm.$emit("executeTask");
      await flushPromises();
      expect(claimWorkOrder).not.toHaveBeenCalled();
      expect(completeWorkOrder).not.toHaveBeenCalled();
      expect(wrapper.find('[aria-label="目的仓指令"] button').exists()).toBe(
        true,
      );
      expect(
        wrapper.find('[aria-label="送仓操作区"] button.primary').exists(),
      ).toBe(true);
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
      const panel = wrapper.getComponent(DeliveryActionPanel);
      if (count === 1) expect(panel.props("task")?.nextAction).toBeNull();
      else expect(panel.props("task")).toBeNull();
      panel.vm.$emit("executeTask");
      await flushPromises();
      expect(wrapper.find(".task-action button").exists()).toBe(false);
      expect(claimWorkOrder).not.toHaveBeenCalled();
      expect(completeWorkOrder).not.toHaveBeenCalled();
      expect(panel.props("deliveredFact")).toBeNull();
    },
  );

  it.each([
    {
      actionCode: "work_execution.claim_work_order",
      label: "领取送仓任务",
      api: claimWorkOrder,
    },
    {
      actionCode: "work_execution.complete_work_order",
      label: "完成送仓工单",
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
      expect(wrapper.getComponent(DeliveryActionPanel).props("task")).toEqual(
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
        wrapper.getComponent(DeliveryActionPanel).props("deliveredFact"),
      ).toBeNull();
      expect(
        wrapper.get('[aria-label="送仓操作区"] button.primary').text(),
      ).toBe("提交实际送仓复核");
    },
  );

  it.each(["appointment", "reference", "evidence"])(
    "UIPS-SP4-PROF-003 keeps both dirty forms, DOM, focus and scroll through new-ID %s replacement and uses live versions",
    async (correction) => {
      const { query } = setupContext();
      const replacements = instructionReplacements(contextIds.container);
      const wrapper = await mountPage(query);
      await fillProfessional(wrapper);
      const instructionPanel = wrapper.get('[aria-label="目的仓指令"]');
      if (correction === "appointment") {
        await instructionPanel
          .findAll('input[type="datetime-local"]')[0]!
          .setValue("2026-09-22T10:00");
        await instructionPanel
          .findAll('input[type="datetime-local"]')[1]!
          .setValue("2026-09-22T11:00");
      } else if (correction === "reference") {
        await instructionPanel
          .findAll("input")[7]!
          .setValue("corrected-reference");
      }
      const factPanel = wrapper.getComponent(DeliveryActionPanel);
      const form = factPanel.element;
      const input = factPanel.get("input").element as HTMLInputElement;
      const evidence = factPanel.get("textarea").element;
      input.focus();
      const outer = wrapper.element.parentElement!;
      outer.scrollTop = 133;
      listDates.mockResolvedValue({ items: [], projectionVersion: 9 });
      await instructionPanel.get("button").trigger("click");
      await flushPromises();
      expect(factPanel.element).toBe(form);
      expect(factPanel.get("textarea").element).toBe(evidence);
      expect((evidence as HTMLTextAreaElement).value).toBe("POD-draft");
      expect(input.value).toBe("2026-09-21T10:00");
      expect(document.activeElement).toBe(input);
      expect(outer.scrollTop).toBe(133);
      expect(instructionPanel.text()).toContain("指令已保存");
      expect(replacements.current.instructionId).not.toBe(
        deliveryInstruction.instructionId,
      );
      expect(replacements.current.version).toBe(2);
      expect(replaceInstruction.mock.calls[0]![1]).toMatchObject({
        expectedVersion: 1,
      });
      const firstId = replacements.current.instructionId;
      await instructionPanel.get("button").trigger("click");
      await flushPromises();
      expect(replaceInstruction.mock.calls[1]![1]).toMatchObject({
        expectedVersion: 2,
      });
      expect(replacements.current.version).toBe(3);
      expect(replacements.current.instructionId).not.toBe(firstId);
      recordDateFact.mockResolvedValue(savedReceipt);
      await factPanel.get("button.primary").trigger("click");
      await flushPromises();
      expect(recordDateFact).toHaveBeenCalledWith(
        contextIds.container,
        expect.objectContaining({
          expectedVersion: 9,
          location: expect.objectContaining({
            locationId: deliveryInstruction.warehouseLocationId,
            timezone: deliveryInstruction.timezone,
          }),
        }),
      );
      expect(
        (instructionPanel.get("textarea").element as HTMLTextAreaElement).value,
      ).toBe("instruction-draft");
    },
  );

  it.each(["warehouse", "timezone"])(
    "new-ID %s replacement preserves dirty input but blocks fact writes until explicit re-entry",
    async (change) => {
      const { query } = setupContext();
      const replacements = instructionReplacements(contextIds.container);
      const wrapper = await mountPage(query);
      await fillProfessional(wrapper);
      const panel = wrapper.getComponent(DeliveryActionPanel);
      const input = panel.get("input").element;
      const instructionPanel = wrapper.get('[aria-label="目的仓指令"]');
      await instructionPanel
        .findAll("input")
        [change === "warehouse" ? 0 : 4]!.setValue(
          change === "warehouse"
            ? "66666666-6666-4666-8666-666666666666"
            : "UTC",
        );
      await instructionPanel.get("button").trigger("click");
      await flushPromises();
      expect(replacements.current.instructionId).not.toBe(
        deliveryInstruction.instructionId,
      );
      expect(panel.get("input").element).toBe(input);
      expect((input as HTMLInputElement).value).toBe("2026-09-21T10:00");
      expect((panel.get("textarea").element as HTMLTextAreaElement).value).toBe(
        "POD-draft",
      );
      expect(panel.text()).toContain("目的仓或时区已变化");
      await panel.get("button.primary").trigger("click");
      expect(recordDateFact).not.toHaveBeenCalled();
      await panel.get("[data-recheck-delivery]").trigger("click");
      await fillProfessional(wrapper);
      recordDateFact.mockResolvedValue(savedReceipt);
      await panel.get("button.primary").trigger("click");
      await flushPromises();
      expect(recordDateFact).toHaveBeenCalledTimes(1);
      expect(recordDateFact).toHaveBeenCalledWith(
        contextIds.container,
        expect.objectContaining({
          location: expect.objectContaining({
            locationId: replacements.current.warehouseLocationId,
            timezone: replacements.current.timezone,
          }),
        }),
      );
    },
  );

  it("distinguishes an absent instruction from read failure and rejects stale event writes", async () => {
    const { query } = setupContext();
    const wrapper = await mountPage(query);
    await fillProfessional(wrapper);
    const instructionPanel = wrapper.get('[aria-label="目的仓指令"]');
    const factPanel = wrapper.getComponent(DeliveryActionPanel);
    const hold = deferred<{
      items: LifecycleDateFact[];
      projectionVersion: number;
    }>();
    listDates.mockImplementationOnce(() => hold.promise);
    recordDateFact.mockResolvedValue(savedReceipt);
    factPanel.vm.$emit("submit", availableDraft);
    await flushPromises();
    factPanel.vm.$emit("submit", availableDraft);
    wrapper
      .findComponent({ name: "DeliveryInstructionPanel" })
      .vm.$emit("save", {
        ...deliveryInstruction,
        evidenceInputs: ["must-not-write"],
      });
    expect(recordDateFact).toHaveBeenCalledTimes(1);
    expect(replaceInstruction).not.toHaveBeenCalled();
    hold.resolve({ items: [], projectionVersion: 2 });
    await flushPromises();
    getInstruction.mockRejectedValueOnce(new Error("instruction read failed"));
    await factPanel.get("button.primary").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("目的仓指令读取失败");
    expect(
      (instructionPanel.get("textarea").element as HTMLTextAreaElement).value,
    ).toBe("instruction-draft");
    await instructionPanel.get("button").trigger("click");
    factPanel.vm.$emit("submit", availableDraft);
    expect(replaceInstruction).not.toHaveBeenCalled();
    expect(recordDateFact).toHaveBeenCalledTimes(2);
    await wrapper.get("[data-delivery-reload]").trigger("click");
    await flushPromises();
    expect(factPanel.props("disabled")).toBe(false);
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
      expect(
        wrapper.get(".delivery-context").attributes("inert"),
      ).toBeDefined();
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
        wrapper.get(".delivery-context").attributes("inert"),
      ).toBeUndefined();
      expect(recordDateFact).not.toHaveBeenCalled();
    },
  );

  it("uses one real panel, exact typed refs and preserves dirty form/focus/scroll through all modes", async () => {
    const { query } = setupContext();
    const wrapper = await mountPage(query);
    await fillProfessional(wrapper);
    const panel = wrapper.getComponent(DeliveryActionPanel);
    const instance = panel.vm.$;
    const fields = panel.findAll("input,textarea,select").map((f) => f.element);
    const values = fields.map((f) => (f as HTMLInputElement).value);
    const focused = panel.get("textarea").element as HTMLElement;
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
      const form = wrapper.getComponent(DeliveryActionPanel).element;
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
      expect(wrapper.getComponent(DeliveryActionPanel).element).toBe(form);
      expect(
        wrapper.getComponent(DeliveryActionPanel).attributes("data-dirty"),
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
      const panel = wrapper.getComponent(DeliveryActionPanel);
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
      expect(wrapper.getComponent(DeliveryActionPanel).element).toBe(form);
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
    const instance = wrapper.getComponent(DeliveryActionPanel).vm.$;
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
      "送仓办理",
    );
    expect(wrapper.get('[aria-label="送仓工单领取回执"]').text()).toContain(
      contextIds.work,
    );
    expect(wrapper.getComponent(DeliveryActionPanel).vm.$).toBe(instance);
    expect(
      wrapper.getComponent(DeliveryActionPanel).attributes("data-dirty"),
    ).toBe("true");
    expect(recordDateFact).not.toHaveBeenCalled();
    recordDateFact.mockResolvedValue(savedReceipt);
    wrapper
      .getComponent(DeliveryActionPanel)
      .vm.$emit("submit", availableDraft);
    await flushPromises();
    expect(wrapper.get('[aria-label="送仓工单领取回执"]').text()).toContain(
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
    const panel = wrapper.getComponent(DeliveryActionPanel);
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
      const form = wrapper.getComponent(DeliveryActionPanel).element;
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
        `/workspaces/delivery?containerId=${taskB.containerId}&taskId=${taskB.id}`,
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
      expect(wrapper.find('[aria-label="送仓工单领取回执"]').exists()).toBe(
        false,
      );
      expect(generateCandidate).toHaveBeenCalledTimes(generationCount);
      if (kind === "task") {
        expect(wrapper.getComponent(DeliveryActionPanel).element).toBe(form);
        expect(
          wrapper.getComponent(DeliveryActionPanel).attributes("data-dirty"),
        ).toBe("true");
      } else
        expect(
          wrapper.getComponent(DeliveryActionPanel).attributes("data-dirty"),
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

describe("Delivery late capability responses", () => {
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
    const form = wrapper.getComponent(DeliveryActionPanel).element;
    await wrapper.get('[data-mode-control="ai"]').trigger("click");
    await router.replace(
      `/workspaces/delivery?containerId=${contextIds.container}&taskId=${taskB.id}`,
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
    expect(wrapper.getComponent(DeliveryActionPanel).element).toBe(form);
    expect(
      wrapper.getComponent(DeliveryActionPanel).attributes("data-dirty"),
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
    wrapper.getComponent(DeliveryActionPanel).vm.$emit("executeTask");
    await flushPromises();
    await router.replace(
      `/workspaces/delivery?containerId=${contextIds.container}&taskId=${taskB.id}`,
    );
    await flushPromises();
    wrapper.getComponent(DeliveryActionPanel).vm.$emit("executeTask");
    await flushPromises();
    const reads = listDates.mock.calls.length;
    pendingA.resolve(claimReceipt());
    await flushPromises();
    expect(listDates.mock.calls).toHaveLength(reads);
    expect(
      wrapper.getComponent(DeliveryActionPanel).props("taskSubmitting"),
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
      wrapper.getComponent(DeliveryActionPanel).props("taskSubmitting"),
    ).toBe(false);
    expect(
      wrapper.getComponent(DeliveryActionPanel).props("submission")
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
    title: "建议领取当前送仓工单",
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
  getInstruction.mockReset().mockImplementation(async (id: string) => ({
    ...deliveryInstruction,
    containerRecordId: id,
  }));
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
  kind: "delivered" as const,
  localDateTime: "2026-09-21T10:00",
  evidenceInputs: ["POD-draft"],
};
function instructionReplacements(containerRecordId: string) {
  const state: { current: WarehouseDeliveryInstruction } = {
    current: { ...deliveryInstruction, containerRecordId },
  };
  getInstruction.mockImplementation(async () => state.current);
  replaceInstruction.mockImplementation(
    async (id: string, input: ReplaceWarehouseDeliveryInstructionCommand) => {
      state.current = {
        ...state.current,
        ...input,
        containerRecordId: id,
        instructionId: crypto.randomUUID(),
        version: state.current.version + 1,
      };
      return state.current;
    },
  );
  return state;
}
const savedReceipt: RecordLifecycleDateFactResult = {
  factId: "delivered-fact",
  recordState: "recorded",
  applicationState: "review_required",
  reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
  canonicalEventId: null,
  projectionVersion: 7,
};
async function fillProfessional(
  wrapper: Awaited<ReturnType<typeof mountPage>>,
) {
  await wrapper
    .get('[aria-label="送仓操作区"] input')
    .setValue("2026-09-21T10:00");
  await wrapper.get('[aria-label="送仓操作区"] textarea').setValue("POD-draft");
  await wrapper
    .get('[aria-label="目的仓指令"] textarea')
    .setValue("instruction-draft");
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
    routes: [
      { path: "/workspaces/delivery", component: WarehouseDeliveryWorkbench },
    ],
  });
  await router.push(`/workspaces/delivery?${query}`);
  await router.isReady();
  const wrapper = mount(WarehouseDeliveryWorkbench, {
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
    nodeCode: "warehouse_delivery",
    containerId: container.id,
    taskDefinitionKey: "node-warehouse_delivery",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [
      {
        id: "work-1",
        workOrderDefinitionKey: "delivery",
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
      workOrderDefinitionKey: "delivery",
      assignmentState: "pool",
      assigneeId: null,
      dueAt: null,
    },
    ...overrides,
  };
}
