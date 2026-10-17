import { flushPromises, mount } from "@vue/test-utils";
import { shallowRef } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ObjectActivityItem,
  ObjectNextAction,
} from "../../api/objectActivities";
import type { NodeTaskOutcome } from "../../api/nodeTasks";
import TaskArchivePanel from "./TaskArchivePanel.vue";

const load = vi.fn();
const refresh = vi.fn();
const loadMore = vi.fn();
const archive = {
  items: shallowRef<ObjectActivityItem[]>([]),
  nextActions: shallowRef<ObjectNextAction[]>([]),
  asOf: shallowRef<string | null>(null),
  projectionVersion: shallowRef<number | null>(null),
  loading: shallowRef(false),
  error: shallowRef(""),
  hasMore: shallowRef(false),
  load,
  refresh,
  loadMore,
};

vi.mock("../../composables/useTaskArchive", () => ({
  useTaskArchive: () => archive,
}));

const item = (
  id: string,
  taskId: string | null,
  sourceType: string,
): ObjectActivityItem => ({
  id,
  activityCode:
    sourceType === "canonical_event"
      ? "lifecycle_event_recorded"
      : "task_created",
  sourceType,
  sourceId: `source-${id}`,
  occurredAt: "2026-10-17T03:00:00.000Z",
  recordedAt: "2026-10-17T03:01:00.000Z",
  containerId: "c1",
  taskId,
  workOrderId: null,
  actorId: null,
  nodeCode: "customs_clearance",
  title: id === "original" ? "原任务已生成" : "货柜状态已更新",
  detail: null,
  severity: null,
  targetPath: null,
});

const outcome: NodeTaskOutcome = {
  id: "outcome-1",
  previousState: "in_progress",
  nextState: "completed",
  resultPolicyMode: "all_required_work_orders_completed",
  eventCode: "customs_cleared",
  requiredWorkOrderIds: ["wo-1"],
  completedWorkOrderIds: ["wo-1"],
  evaluatedAt: "2026-10-17T03:04:05.000Z",
};

describe("TaskArchivePanel", () => {
  beforeEach(() => {
    load.mockReset().mockResolvedValue(undefined);
    refresh.mockReset().mockResolvedValue(undefined);
    loadMore.mockReset().mockResolvedValue(undefined);
    archive.items.value = [
      item("original", "task-1", "node_task"),
      item("related", null, "canonical_event"),
      item("other-task", "task-2", "client_operation"),
    ];
    archive.nextActions.value = [
      {
        actionCode: "work_execution.claim_work_order",
        containerId: "c1",
        taskId: "task-2",
        workOrderId: "wo-2",
        nodeCode: "pickup",
        taskDefinitionKey: "node-pickup",
        workOrderDefinitionKey: "wo-pickup",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
        targetPath: "/tasks?task=task-2",
      },
    ];
    archive.asOf.value = "2026-10-17T03:05:00.000Z";
    archive.projectionVersion.value = 9;
    archive.loading.value = false;
    archive.error.value = "";
    archive.hasMore.value = true;
  });

  it("separates original task records from neutral related object facts", async () => {
    const wrapper = mount(TaskArchivePanel, {
      props: { containerId: "c1", taskId: "task-1", outcome },
      global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
    });
    await flushPromises();

    expect(load).toHaveBeenCalledWith("c1");
    expect(wrapper.get('[aria-label="原任务记录"]').text()).toContain(
      "原任务已生成",
    );
    const related = wrapper.get('[aria-label="相关对象事实"]');
    expect(related.text()).toContain("货柜状态已更新");
    expect(related.text()).toContain(
      "不代表原任务结果、责任交接或后续完成证据",
    );
    expect(related.text()).not.toContain("下游");
    expect(wrapper.get('[data-testid="archive-outcome"]').text()).toContain(
      "已完成",
    );
    expect(wrapper.get('[aria-label="当前可见后续办理"]').text()).toContain(
      "领取工单",
    );
  });

  it("states the bounded coverage without treating projection version as source version", () => {
    const wrapper = mount(TaskArchivePanel, {
      props: { containerId: "c1", taskId: "task-1", outcome },
      global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
    });

    expect(wrapper.text()).toContain("当前身份可见来源");
    expect(wrapper.text()).toContain("部分来源可能因权限不可见");
    expect(wrapper.text()).toContain("正式责任交接快照未接通");
    expect(wrapper.text()).toContain("来源版本未接通");
    expect(wrapper.text()).toContain("协作和 AI 轨道未接通");
    expect(wrapper.text()).toContain("任务来源最多 200 条");
    expect(wrapper.text()).toContain("当前来源未提供版本");
    expect(wrapper.text()).toContain("组合投影版本 9");
    expect(wrapper.text()).not.toContain("来源版本 9");
    expect(wrapper.text()).not.toContain("完整档案");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("keeps internal titles and opaque assignee IDs inside collapsed technical details", () => {
    archive.items.value = [
      {
        ...item("event", null, "canonical_event"),
        activityCode: "lifecycle_event_recorded",
        title: "customs_cleared",
      },
      {
        ...item("task", "task-1", "node_task"),
        activityCode: "task_created",
        title: "wo-customs",
      },
      {
        ...item("receipt", "task-1", "client_operation"),
        activityCode: "work_order_completed",
        title: "operation-definition-key",
      },
    ];
    archive.nextActions.value = [
      {
        actionCode: "work_execution.complete_work_order",
        containerId: "c1",
        taskId: "task-1",
        workOrderId: "work-order-1",
        nodeCode: "customs_clearance",
        taskDefinitionKey: "node-customs",
        workOrderDefinitionKey: "wo-customs",
        assignmentState: "assigned",
        assigneeId: "user-uuid",
        dueAt: null,
        targetPath: "/tasks?task=task-1",
      },
    ];

    const wrapper = mount(TaskArchivePanel, {
      props: { containerId: "c1", taskId: "task-1", outcome },
      global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } },
    });

    const headlines = wrapper
      .findAll(".archive-record__headline b")
      .map((headline) => headline.text());
    expect(headlines).toEqual(["任务已生成", "工单已完成", "生命周期事实"]);
    expect(headlines.join(" ")).not.toMatch(
      /customs_cleared|wo-customs|operation-definition-key/,
    );
    const nextAction = wrapper.get(".archive-next-actions li");
    expect(nextAction.get("b").text()).toBe("完成工单");
    expect(nextAction.findAll("div > span")[0]?.text()).toBe(
      "责任：已分配人员",
    );
    expect(
      nextAction
        .findAll("div > span")
        .map((line) => line.text())
        .join(" "),
    ).not.toContain("user-uuid");

    const technicalDetails = wrapper.findAll("details");
    expect(
      technicalDetails.every((details) => !details.attributes("open")),
    ).toBe(true);
    expect(technicalDetails.map((details) => details.text()).join(" ")).toMatch(
      /customs_cleared|wo-customs|operation-definition-key|user-uuid|canonical_event|source-event/,
    );
  });

  it("shows loading, failure recovery, refresh, and load-more controls", async () => {
    archive.items.value = [];
    archive.loading.value = true;
    archive.error.value = "";
    const wrapper = mount(TaskArchivePanel, {
      props: { containerId: "c1", taskId: "task-1", outcome: null },
      global: { stubs: { RouterLink: true } },
    });
    expect(wrapper.get('[role="status"]').text()).toContain("读取档案");

    archive.loading.value = false;
    archive.error.value = "FORBIDDEN";
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="alert"]').text()).toContain("FORBIDDEN");
    await wrapper.get('[data-testid="archive-retry"]').trigger("click");
    expect(refresh).toHaveBeenCalledTimes(1);

    archive.error.value = "";
    archive.items.value = [item("original", "task-1", "node_task")];
    archive.hasMore.value = true;
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="archive-refresh"]').trigger("click");
    await wrapper.get('[data-testid="archive-load-more"]').trigger("click");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
