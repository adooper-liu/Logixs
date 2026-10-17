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
  return { workspace: workspace!, app, router };
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const taskPage = (
  containerId: string,
  options: { cursor?: string | null; hasMore?: boolean; withOutcome?: boolean },
) => ({
  items: [
    {
      id: `task-${containerId}`,
      flowInstanceId: `flow-${containerId}`,
      nodeInstanceId: `node-${containerId}`,
      nodeCode: containerId === "c1" ? "customs_clearance" : "container_pickup",
      containerId,
      taskDefinitionKey: `definition-${containerId}`,
      state: options.withOutcome ? "completed" : "pending",
      workOrders: [],
      outcome: options.withOutcome
        ? {
            id: `outcome-${containerId}`,
            previousState: "in_progress",
            nextState: "completed",
            resultPolicyMode: "all_required_work_orders_completed",
            eventCode: "customs_cleared",
            requiredWorkOrderIds: [],
            completedWorkOrderIds: [],
            evaluatedAt: "2026-10-17T03:04:05.000Z",
          }
        : null,
      nextAction: null,
    },
  ],
  pageInfo: {
    nextCursor: options.cursor ?? null,
    hasNextPage: options.hasMore ?? false,
    pageSize: 200,
  },
  asOf: "2026-10-17T03:04:05.000Z",
  projectionVersion: 1,
});

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
              dueAt: null,
              completedAt: null,
            },
          ],
          outcome: null,
          nextAction: {
            actionCode: "work_execution.claim_work_order",
            workOrderId: "w1",
            workOrderDefinitionKey: "wo-customs",
            assignmentState: "unassigned",
            assigneeId: null,
            dueAt: null,
          },
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

  it("B 先完成后忽略 A 的迟到成功并保留 B 的分页和结果", async () => {
    const first = deferred<ReturnType<typeof taskPage>>();
    const second = deferred<ReturnType<typeof taskPage>>();
    listContainers.mockResolvedValue({
      items: [
        {
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
        {
          id: "c2",
          orderNumber: "PO-2",
          containerNumber: "MSCU2",
          currentStatus: "at_port",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
      ],
    });
    listNodeTasks
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { workspace, app, router } = await setupWorkspace();

    await router.replace("/tasks?containerId=c1");
    const loadA = workspace.reload();
    await router.replace("/tasks?containerId=c2");
    const loadB = workspace.reload();
    second.resolve(
      taskPage("c2", { cursor: "cursor-b", hasMore: true, withOutcome: true }),
    );
    await loadB;
    first.resolve(taskPage("c1", { cursor: null, hasMore: false }));
    await loadA;

    expect(listNodeTasks).toHaveBeenNthCalledWith(1, {
      pageSize: 200,
      containerId: "c1",
    });
    expect(listNodeTasks).toHaveBeenNthCalledWith(2, {
      pageSize: 200,
      containerId: "c2",
    });
    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "task-c2",
    ]);
    expect(workspace.activeTask.value?.taskId).toBe("task-c2");
    expect(workspace.activeContainer.value?.containerRecordId).toBe("c2");
    expect(workspace.activeTaskOutcome.value?.id).toBe("outcome-c2");
    expect(workspace.loading.value).toBe(false);
    expect(workspace.error.value).toBe("");
    expect(workspace.hasMore.value).toBe(true);
    await workspace.loadMore();
    expect(listNodeTasks).toHaveBeenLastCalledWith({
      pageSize: 200,
      containerId: "c2",
      cursor: "cursor-b",
    });
    app.unmount();
  });

  it("A 的迟到失败不会结束仍在进行的 B 或写入错误", async () => {
    const first = deferred<ReturnType<typeof taskPage>>();
    const second = deferred<ReturnType<typeof taskPage>>();
    listContainers.mockResolvedValue({
      items: [
        {
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
        {
          id: "c2",
          orderNumber: "PO-2",
          containerNumber: "MSCU2",
          currentStatus: "at_port",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
      ],
    });
    listNodeTasks
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { workspace, app, router } = await setupWorkspace();

    await router.replace("/tasks?containerId=c1");
    const loadA = workspace.reload();
    await router.replace("/tasks?containerId=c2");
    const loadB = workspace.reload();
    first.reject(new Error("FORBIDDEN"));
    await loadA;

    expect(workspace.loading.value).toBe(true);
    expect(workspace.error.value).toBe("");
    second.resolve(taskPage("c2", { cursor: null, hasMore: false }));
    await loadB;
    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "task-c2",
    ]);
    expect(workspace.activeContainer.value?.containerRecordId).toBe("c2");
    expect(workspace.loading.value).toBe(false);
    expect(workspace.error.value).toBe("");
    expect(workspace.hasMore.value).toBe(false);
    app.unmount();
  });

  it("切换到 B 后丢弃 A 的迟到分页且不结束 B 的分页状态", async () => {
    const moreA = deferred<ReturnType<typeof taskPage>>();
    const moreB = deferred<ReturnType<typeof taskPage>>();
    listContainers.mockResolvedValue({
      items: [
        {
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
        {
          id: "c2",
          orderNumber: "PO-2",
          containerNumber: "MSCU2",
          currentStatus: "at_port",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
      ],
    });
    listNodeTasks
      .mockResolvedValueOnce(
        taskPage("c1", { cursor: "cursor-a", hasMore: true }),
      )
      .mockReturnValueOnce(moreA.promise)
      .mockResolvedValueOnce(
        taskPage("c2", {
          cursor: "cursor-b",
          hasMore: true,
          withOutcome: true,
        }),
      )
      .mockReturnValueOnce(moreB.promise);
    const { workspace, app, router } = await setupWorkspace();

    await router.replace("/tasks?containerId=c1");
    await workspace.reload();
    const loadMoreA = workspace.loadMore();
    await router.replace("/tasks?containerId=c2");
    await workspace.reload();
    const loadMoreB = workspace.loadMore();

    moreA.resolve(
      taskPage("c-a-extra", { cursor: "cursor-a-2", hasMore: true }),
    );
    await loadMoreA;

    expect(listNodeTasks).toHaveBeenNthCalledWith(4, {
      pageSize: 200,
      containerId: "c2",
      cursor: "cursor-b",
    });
    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "task-c2",
    ]);
    expect(workspace.activeTask.value?.taskId).toBe("task-c2");
    expect(workspace.activeContainer.value?.containerRecordId).toBe("c2");
    expect(workspace.activeTaskOutcome.value?.id).toBe("outcome-c2");
    expect(workspace.loading.value).toBe(false);
    expect(workspace.loadingMore.value).toBe(true);
    expect(workspace.moreError.value).toBe("");
    expect(workspace.hasMore.value).toBe(true);
    expect(getContainer).not.toHaveBeenCalled();

    moreB.resolve({
      ...taskPage("c2", { cursor: null, hasMore: false, withOutcome: true }),
      items: [],
    });
    await loadMoreB;
    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "task-c2",
    ]);
    expect(workspace.loadingMore.value).toBe(false);
    expect(workspace.hasMore.value).toBe(false);
    app.unmount();
  });

  it("切换到 B 后 A 的迟到分页失败不写入 moreError", async () => {
    const moreA = deferred<ReturnType<typeof taskPage>>();
    listContainers.mockResolvedValue({
      items: [
        {
          id: "c1",
          orderNumber: "PO-1",
          containerNumber: "MSCU1",
          currentStatus: "in_transit",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
        {
          id: "c2",
          orderNumber: "PO-2",
          containerNumber: "MSCU2",
          currentStatus: "at_port",
          updatedAt: "2026-10-17T03:00:00.000Z",
        },
      ],
    });
    listNodeTasks
      .mockResolvedValueOnce(
        taskPage("c1", { cursor: "cursor-a", hasMore: true }),
      )
      .mockReturnValueOnce(moreA.promise)
      .mockResolvedValueOnce(
        taskPage("c2", { cursor: null, hasMore: false, withOutcome: true }),
      );
    const { workspace, app, router } = await setupWorkspace();

    await router.replace("/tasks?containerId=c1");
    await workspace.reload();
    const loadMoreA = workspace.loadMore();
    await router.replace("/tasks?containerId=c2");
    await workspace.reload();
    moreA.reject(new Error("FORBIDDEN"));
    await loadMoreA;

    expect(workspace.tasks.value.map((task) => task.taskId)).toEqual([
      "task-c2",
    ]);
    expect(workspace.activeContainer.value?.containerRecordId).toBe("c2");
    expect(workspace.activeTaskOutcome.value?.id).toBe("outcome-c2");
    expect(workspace.moreError.value).toBe("");
    expect(workspace.loading.value).toBe(false);
    expect(workspace.loadingMore.value).toBe(false);
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
              dueAt: null,
              completedAt: null,
            },
          ],
          outcome: null,
          nextAction: {
            actionCode: "work_execution.complete_work_order",
            workOrderId: "w1",
            workOrderDefinitionKey: "wo-customs",
            assignmentState: "assigned",
            assigneeId: "dev-operator",
            dueAt: null,
          },
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

  it("装箱未核对准单证则不能完成工单", async () => {
    listNodeTasks.mockResolvedValue({
      items: [
        {
          id: "t1",
          flowInstanceId: "f1",
          nodeInstanceId: "n1",
          nodeCode: "container_stuffing",
          containerId: "c1",
          taskDefinitionKey: "node-container_stuffing",
          state: "in_progress",
          workOrders: [
            {
              id: "w1",
              workOrderDefinitionKey: "wo-stuffing",
              state: "in_progress",
              assignmentState: "assigned",
              assigneeId: "dev-operator",
              dueAt: null,
              completedAt: null,
            },
          ],
          outcome: null,
          nextAction: {
            actionCode: "work_execution.complete_work_order",
            workOrderId: "w1",
            workOrderDefinitionKey: "wo-stuffing",
            assignmentState: "assigned",
            assigneeId: "dev-operator",
            dueAt: null,
          },
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    const { workspace, app } = await setupWorkspace();
    await workspace.reload();
    await flushPromises();
    expect(workspace.canSubmit.value).toBe(false);
    await workspace.executeAction("work_execution.complete_work_order:w1");
    await flushPromises();
    expect(completeWorkOrder).not.toHaveBeenCalled();
    workspace.verifyEvidence(
      "evidence-t1",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(workspace.canSubmit.value).toBe(true);
    completeWorkOrder.mockResolvedValue({
      workOrderId: "w1",
      workOrderState: "completed",
      taskId: "t1",
      taskState: "completed",
      applied: true,
      outcomeRecorded: true,
      lifecycleApply: "applied",
      lifecycleEventCode: "stuffed",
      lifecycleDetail: null,
      activatedNodeCode: "shipment_dispatch",
      activatedNodeTaskId: "t2",
      clientOperationId: "op-1",
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    });
    await workspace.executeAction("work_execution.complete_work_order:w1");
    await flushPromises();
    expect(completeWorkOrder).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({
        evidenceRefs: ["11111111-1111-4111-8111-111111111111"],
      }),
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
            nextAction: null,
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
            nextAction: null,
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
            nextAction: null,
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
            nextAction: null,
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
            nextAction: null,
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

  it("直接暴露当前任务的原始 outcome，并在切换后清空", async () => {
    const outcome = {
      id: "outcome-1",
      previousState: "in_progress",
      nextState: "completed",
      resultPolicyMode: "all_required_work_orders_completed",
      eventCode: "customs_cleared",
      requiredWorkOrderIds: ["w1"],
      completedWorkOrderIds: ["w1"],
      evaluatedAt: "2026-10-17T03:04:05.000Z",
    };
    listNodeTasks.mockResolvedValue({
      items: [
        {
          id: "t-completed",
          flowInstanceId: "f1",
          nodeInstanceId: "n1",
          nodeCode: "customs_clearance",
          containerId: "c1",
          taskDefinitionKey: "node-customs_clearance",
          state: "completed",
          applicability: "required",
          readinessState: "ready",
          completionEligibility: "eligible",
          conditionFactRefs: [],
          workOrders: [],
          outcome,
          nextAction: null,
        },
        {
          id: "t-open",
          flowInstanceId: "f1",
          nodeInstanceId: "n2",
          nodeCode: "pickup",
          containerId: "c1",
          taskDefinitionKey: "node-pickup",
          state: "pending",
          applicability: "required",
          readinessState: "ready",
          completionEligibility: "awaiting_evidence",
          conditionFactRefs: [],
          workOrders: [],
          outcome: null,
          nextAction: null,
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-10-17T03:04:05.000Z",
      projectionVersion: 1,
    });

    const { workspace, app } = await setupWorkspace();
    await workspace.reload();

    expect(workspace.activeTaskOutcome.value).toBe(outcome);
    workspace.selectTask("t-open");
    expect(workspace.activeTaskOutcome.value).toBeNull();
    app.unmount();
  });
});
