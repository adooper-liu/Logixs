import { createApp } from "vue";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveWorkspace } from "./useLiveWorkspace";

const listContainers = vi.fn();
const listNodeTasks = vi.fn();
const claimWorkOrder = vi.fn();
const completeWorkOrder = vi.fn();
const getContainer = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
  getContainer: (...args: unknown[]) => getContainer(...args),
}));

vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
  claimWorkOrder: (...args: unknown[]) => claimWorkOrder(...args),
  completeWorkOrder: (...args: unknown[]) => completeWorkOrder(...args),
  DEV_OPERATOR_ID: "dev-operator",
}));

async function setupWorkspace() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/tasks", component: { template: "<div />" } }],
  });
  await router.push("/tasks");
  await router.isReady();
  let workspace: ReturnType<typeof useLiveWorkspace> | undefined;
  const app = createApp({
    setup() {
      workspace = useLiveWorkspace();
      return () => undefined;
    },
  });
  app.use(router);
  app.mount(document.createElement("div"));
  return { workspace: workspace!, app };
}

describe("useLiveWorkspace", () => {
  beforeEach(() => {
    listContainers.mockReset();
    listNodeTasks.mockReset();
    claimWorkOrder.mockReset();
    completeWorkOrder.mockReset();
    getContainer.mockReset();
    listContainers.mockResolvedValue({
      items: [
        {
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-09-13T03:00:00.000Z",
        },
      ],
    });
    listNodeTasks.mockResolvedValue({
      items: [
        {
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
          ],
          outcome: null,
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
  });

  it("首屏失败时只说任务没能加载", async () => {
    listNodeTasks.mockRejectedValue(new Error("Failed to fetch"));
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await flushPromises();
    expect(workspace.error.value).toBe("任务没能加载");
    expect(workspace.tasks.value).toEqual([]);
    app.unmount();
  });

  it("未限定货柜时一次按租户列任务，可领只出领取", async () => {
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
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await flushPromises();
    expect(listContainers).toHaveBeenCalledWith({ pageSize: 200 });
    expect(listNodeTasks).toHaveBeenCalledTimes(1);
    expect(listNodeTasks).toHaveBeenCalledWith({ pageSize: 200 });
    expect(workspace.tasks.value[0]?.nodeName).toBe("清关");
    expect(workspace.tasks.value[0]?.actions[0]?.intent).toBe("claim");
    expect(workspace.canSubmit.value).toBe(false);
    expect(workspace.hasMore.value).toBe(false);
    await workspace.executeAction("work_execution.claim_work_order:w1");
    await flushPromises();
    expect(claimWorkOrder).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(completeWorkOrder).not.toHaveBeenCalled();
    app.unmount();
  });

  it("已领取后才能完成工单", async () => {
    listNodeTasks.mockResolvedValue({
      items: [
        {
          id: "t1",
          flowInstanceId: "f1",
          nodeInstanceId: "n1",
          nodeCode: "customs_clearance",
          containerId: "c1",
          taskDefinitionKey: "node-customs_clearance",
          state: "in_progress",
          workOrders: [
            {
              id: "w1",
              workOrderDefinitionKey: "wo-customs",
              state: "in_progress",
              assignmentState: "assigned",
              assigneeId: "dev-operator",
              completedAt: null,
            },
          ],
          outcome: null,
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T03:00:00.000Z",
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
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await flushPromises();
    expect(workspace.canSubmit.value).toBe(true);
    await workspace.executeAction("work_execution.complete_work_order:w1");
    await flushPromises();
    expect(completeWorkOrder).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    app.unmount();
  });

  it("有下一页时追加任务，并补没有柜号的货柜", async () => {
    listNodeTasks
      .mockResolvedValueOnce({
        items: [
          {
            id: "t1",
            flowInstanceId: "f1",
            nodeInstanceId: "n1",
            nodeCode: "customs_clearance",
            containerId: "c1",
            taskDefinitionKey: "node-customs_clearance",
            state: "pending",
            workOrders: [],
            outcome: null,
          },
        ],
        pageInfo: {
          nextCursor: "cur-2",
          hasNextPage: true,
          pageSize: 200,
        },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "t2",
            flowInstanceId: "f2",
            nodeInstanceId: "n2",
            nodeCode: "container_stuffing",
            containerId: "c2",
            taskDefinitionKey: "node-container_stuffing",
            state: "pending",
            workOrders: [],
            outcome: null,
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      });
    getContainer.mockResolvedValue({
      id: "c2",
      orderNumber: "PO-2",
      containerNumber: "MSCU2",
      currentStatus: "shipped",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await flushPromises();
    expect(workspace.hasMore.value).toBe(true);
    await workspace.loadMore();
    await flushPromises();
    expect(listNodeTasks).toHaveBeenLastCalledWith({
      pageSize: 200,
      cursor: "cur-2",
    });
    expect(getContainer).toHaveBeenCalledWith("c2");
    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "t1",
      "t2",
    ]);
    expect(workspace.tasks.value[1]?.containerNumber).toBe("MSCU2");
    expect(workspace.hasMore.value).toBe(false);
    app.unmount();
  });

  it("再拉失败时已有任务还在", async () => {
    listNodeTasks
      .mockResolvedValueOnce({
        items: [
          {
            id: "t1",
            flowInstanceId: "f1",
            nodeInstanceId: "n1",
            nodeCode: "customs_clearance",
            containerId: "c1",
            taskDefinitionKey: "node-customs_clearance",
            state: "pending",
            workOrders: [],
            outcome: null,
          },
        ],
        pageInfo: {
          nextCursor: "cur-2",
          hasNextPage: true,
          pageSize: 200,
        },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      })
      .mockRejectedValueOnce(new Error("列节点任务失败"));
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await flushPromises();
    await workspace.loadMore();
    await flushPromises();
    expect(workspace.tasks.value).toHaveLength(1);
    expect(workspace.moreError.value).toBe("后面的任务没能加载");
    expect(workspace.hasMore.value).toBe(true);
    app.unmount();
  });

  it("补柜失败时后一页任务仍留下", async () => {
    listNodeTasks
      .mockResolvedValueOnce({
        items: [
          {
            id: "t1",
            flowInstanceId: "f1",
            nodeInstanceId: "n1",
            nodeCode: "customs_clearance",
            containerId: "c1",
            taskDefinitionKey: "node-customs_clearance",
            state: "pending",
            workOrders: [],
            outcome: null,
          },
        ],
        pageInfo: {
          nextCursor: "cur-2",
          hasNextPage: true,
          pageSize: 200,
        },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "t2",
            flowInstanceId: "f2",
            nodeInstanceId: "n2",
            nodeCode: "container_stuffing",
            containerId: "c2",
            taskDefinitionKey: "node-container_stuffing",
            state: "pending",
            workOrders: [],
            outcome: null,
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
        asOf: "2026-09-13T03:00:00.000Z",
        projectionVersion: 0,
      });
    getContainer.mockRejectedValue(new Error("RESOURCE_NOT_FOUND"));
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await workspace.loadMore();
    await flushPromises();
    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "t1",
      "t2",
    ]);
    expect(workspace.tasks.value[1]?.containerNumber).toBe("无箱号");
    app.unmount();
  });
});
