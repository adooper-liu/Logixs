import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RealTaskWorkbench from "./RealTaskWorkbench.vue";

const listContainers = vi.fn();
const listNodeTasks = vi.fn();
const claimWorkOrder = vi.fn();
const completeWorkOrder = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
}));

vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
  claimWorkOrder: (...args: unknown[]) => claimWorkOrder(...args),
  completeWorkOrder: (...args: unknown[]) => completeWorkOrder(...args),
  DEV_OPERATOR_ID: "dev-operator",
}));

const readyTask = {
  id: "t1",
  flowInstanceId: "f1",
  nodeInstanceId: "n1",
  nodeCode: "customs_clearance",
  containerId: "c1",
  taskDefinitionKey: "node-customs_clearance",
  state: "pending",
  workOrders: [
    {
      id: "w1",
      workOrderDefinitionKey: "wo-customs",
      state: "ready",
      assignmentState: "unassigned",
      assigneeId: null,
      completedAt: null,
    },
    {
      id: "w2",
      workOrderDefinitionKey: "wo-done",
      state: "completed",
      assignmentState: "done",
      assigneeId: "dev-operator",
      completedAt: "2026-09-13T00:00:00.000Z",
    },
  ],
  outcome: null,
};

const claimedTask = {
  ...readyTask,
  state: "in_progress",
  workOrders: [
    {
      ...readyTask.workOrders[0]!,
      state: "in_progress",
      assignmentState: "assigned",
      assigneeId: "dev-operator",
    },
    readyTask.workOrders[1]!,
  ],
};

async function mountPage(path = "/real-tasks?containerId=c1") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/real-tasks", component: RealTaskWorkbench }],
  });
  await router.push(path);
  await router.isReady();
  return mount(RealTaskWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title", "eyebrow"],
          template: "<header><h2>{{ title }}</h2></header>",
        },
      },
    },
  });
}

describe("RealTaskWorkbench", () => {
  beforeEach(() => {
    listContainers.mockReset();
    listNodeTasks.mockReset();
    claimWorkOrder.mockReset();
    completeWorkOrder.mockReset();
    listContainers.mockResolvedValue({
      items: [
        {
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "not_shipped",
          updatedAt: "2026-09-13T00:00:00.000Z",
        },
      ],
    });
    listNodeTasks.mockResolvedValue({
      items: [readyTask],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 0,
    });
    vi.stubGlobal("crypto", { randomUUID: () => "complete-key-1" });
  });

  it("无货柜时不列任务、不占回执位", async () => {
    const wrapper = await mountPage("/real-tasks");
    await flushPromises();
    expect(listNodeTasks).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("先选择货柜再查看任务");
    expect(wrapper.find('[data-testid="submission-progress"]').exists()).toBe(
      false,
    );
  });

  it("可领工单只出领取，不出现完成工单", async () => {
    claimWorkOrder.mockResolvedValue({
      workOrderId: "w1",
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: "dev-operator",
      taskId: "t1",
      taskState: "in_progress",
      applied: true,
      clientOperationId: "op-1",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    });
    listNodeTasks
      .mockResolvedValueOnce({
        items: [readyTask],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      })
      .mockResolvedValueOnce({
        items: [claimedTask],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
        asOf: "2026-09-13T00:00:00.000Z",
        projectionVersion: 0,
      });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.get('[data-work-order-id="w1"]').text()).toBe("领取");
    expect(wrapper.find('[data-action="complete"]').exists()).toBe(false);

    await wrapper.get('[data-work-order-id="w1"]').trigger("click");
    await flushPromises();
    expect(claimWorkOrder).toHaveBeenCalledWith("w1", {
      idempotencyKey: "complete-key-1",
    });
    expect(completeWorkOrder).not.toHaveBeenCalled();
    expect(wrapper.get('[data-action="complete"]').text()).toBe("完成工单");
  });

  it("完成已领工单后在动作旁显示已落账三段回执", async () => {
    listNodeTasks.mockResolvedValue({
      items: [claimedTask],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 0,
    });
    completeWorkOrder.mockResolvedValue({
      workOrderId: "w1",
      workOrderState: "completed",
      taskId: "t1",
      taskState: "completed",
      applied: true,
      outcomeRecorded: true,
      lifecycleApply: "not_applicable",
      lifecycleEventCode: null,
      lifecycleDetail: null,
      activatedNodeCode: null,
      activatedNodeTaskId: null,
      clientOperationId: "op-1",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("按柜查看任务");
    expect(wrapper.text()).toContain("customs_clearance");
    expect(wrapper.find('[data-testid="submission-progress"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-work-order-id="w2"]').exists()).toBe(false);

    await wrapper.get('[data-work-order-id="w1"]').trigger("click");
    await flushPromises();

    expect(completeWorkOrder).toHaveBeenCalledWith("w1", {
      evidenceRefs: [],
      idempotencyKey: "complete-key-1",
    });
    const receipt = wrapper.get('[data-testid="submission-progress"]');
    expect(receipt.text()).toContain("完成工单");
    expect(receipt.text()).toContain("已入账");
    expect(receipt.text()).toContain("已接收");
    expect(receipt.text()).toContain("已确认");
    expect(receipt.text()).not.toContain("op-1");
  });

  it("业务拒绝显示错误且不改写成完成", async () => {
    listNodeTasks.mockResolvedValue({
      items: [claimedTask],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 0,
    });
    completeWorkOrder.mockRejectedValue(
      new Error("完成工单失败（409）：EVIDENCE_REQUIRED: 缺少合格证据"),
    );
    const wrapper = await mountPage();
    await flushPromises();
    await wrapper.get('[data-work-order-id="w1"]').trigger("click");
    await flushPromises();
    const receipt = wrapper.get('[data-testid="submission-progress"]');
    expect(receipt.get(".message.error").text()).toContain("缺少合格证据");
    expect(receipt.get(".message.error").text()).not.toContain("已入账");
    expect(receipt.find("button.retry").exists()).toBe(false);
  });

  it("装箱空单证不提交完成工单", async () => {
    const stuffing = {
      ...claimedTask,
      nodeCode: "container_stuffing",
      taskDefinitionKey: "node-container_stuffing",
    };
    listNodeTasks.mockResolvedValue({
      items: [stuffing],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T00:00:00.000Z",
      projectionVersion: 0,
    });
    const wrapper = await mountPage();
    await flushPromises();
    expect(wrapper.get(".evidence").text()).toContain("单证编号");
    await wrapper.get('[data-work-order-id="w1"]').trigger("click");
    await flushPromises();
    expect(completeWorkOrder).not.toHaveBeenCalled();
    const receipt = wrapper.get('[data-testid="submission-progress"]');
    expect(receipt.get(".message.error").text()).toContain("缺少合格证据");
  });
});
