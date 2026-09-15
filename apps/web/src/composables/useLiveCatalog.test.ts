/* eslint-disable vue/one-component-per-file */
import { createApp } from "vue";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveCatalog } from "./useLiveCatalog";

const listContainers = vi.fn();
const listNodeTasks = vi.fn();
const listCurrentNodes = vi.fn();
const listClientOperations = vi.fn();
const listLifecycleNodesByContainers = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
}));

vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
}));

vi.mock("../api/lifecycleCurrentNodes", () => ({
  listCurrentNodes: (...args: unknown[]) => listCurrentNodes(...args),
}));

vi.mock("../api/clientOperations", () => ({
  listClientOperations: (...args: unknown[]) => listClientOperations(...args),
}));

vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodesByContainers: (...args: unknown[]) =>
    listLifecycleNodesByContainers(...args),
}));

describe("useLiveCatalog", () => {
  beforeEach(() => {
    listContainers.mockReset();
    listNodeTasks.mockReset();
    listCurrentNodes.mockReset();
    listClientOperations.mockReset();
    listLifecycleNodesByContainers.mockReset();
    listLifecycleNodesByContainers.mockResolvedValue({
      items: [],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listClientOperations.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listCurrentNodes.mockResolvedValue({
      items: [],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listNodeTasks.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
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
  });

  it("按最大页拉取货柜并按 id 查找", async () => {
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(listContainers).toHaveBeenCalledWith({ pageSize: 200 });
    expect(listNodeTasks).toHaveBeenCalledWith({ pageSize: 200 });
    expect(listCurrentNodes).toHaveBeenCalledWith(["c1"]);
    expect(listClientOperations).toHaveBeenCalledWith({ pageSize: 200 });
    expect(listLifecycleNodesByContainers).toHaveBeenCalledWith(["c1"]);
    expect(catalog!.tasksReady.value).toBe(true);
    expect(catalog!.stationsReady.value).toBe(true);
    expect(catalog!.syncReady.value).toBe(true);
    expect(catalog!.railsReady.value).toBe(true);
    expect(catalog!.containers.value[0]?.rail).toEqual([]);
    expect(catalog!.containers.value[0]?.containerNumber).toBe("MSCU1");
    expect(catalog!.containers.value[0]?.taskStatus.code).toBe("idle");
    expect(catalog!.containers.value[0]?.syncStatus.code).toBe("idle");
    expect(catalog!.containers.value[0]?.currentNode).toBe("");
    expect(catalog!.findById("c1")?.orderNumber).toBe("PO-1");
    expect(catalog!.findById("missing")).toBeUndefined();
    app.unmount();
  });

  it("把未完成任务挂到对应货柜", async () => {
    listNodeTasks.mockResolvedValue({
      items: [
        {
          id: "t1",
          flowInstanceId: "f1",
          nodeInstanceId: "n1",
          nodeCode: "container_stuffing",
          containerId: "c1",
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
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.containers.value[0]?.taskStatus.label).toBe(
      "装箱完成 · 进行中",
    );
    app.unmount();
  });

  it("把已有流程的当前站挂到货柜", async () => {
    listCurrentNodes.mockResolvedValue({
      items: [
        {
          containerId: "c1",
          currentNodeCode: "origin_departure",
          flowState: "active",
        },
      ],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.containers.value[0]?.currentNode).toBe("离港");
    app.unmount();
  });

  it("把已落库节点挂成迷你轨", async () => {
    listLifecycleNodesByContainers.mockResolvedValue({
      items: [
        {
          containerId: "c1",
          flow: {
            id: "f1",
            state: "active",
            currentNodeCode: "shipment_dispatch",
            version: 1,
          },
          nodes: [
            {
              nodeInstanceId: "n1",
              nodeCode: "shipment_dispatch",
              sequence: 3,
              state: "active",
              applicability: "required",
              completedAt: null,
              isCurrent: true,
            },
          ],
        },
      ],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.containers.value[0]?.rail[0]?.name).toBe("出运");
    expect(catalog!.railsReady.value).toBe(true);
    app.unmount();
  });

  it("把最近一次提交挂到对应货柜", async () => {
    listClientOperations.mockResolvedValue({
      items: [
        {
          clientOperationId: "op-1",
          actionCode: "work_execution.complete_work_order",
          receptionState: "received",
          businessDecisionState: "accepted",
          commitState: "committed",
          rejectionReasonCode: null,
          resultRefs: [{ entityType: "container", entityId: "c1" }],
          traceId: "trace-1",
          targetType: "work_order",
          targetId: "w1",
          createdAt: "2026-09-13T03:00:00.000Z",
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.containers.value[0]?.syncStatus.label).toBe("已入账");
    expect(catalog!.syncReady.value).toBe(true);
    app.unmount();
  });

  it("工单提交没有柜引用时，用已拉到的任务挂回去", async () => {
    listNodeTasks.mockResolvedValue({
      items: [
        {
          id: "t1",
          flowInstanceId: "f1",
          nodeInstanceId: "n1",
          nodeCode: "container_stuffing",
          containerId: "c1",
          taskDefinitionKey: "node-container_stuffing",
          state: "completed",
          workOrders: [
            {
              id: "w1",
              workOrderDefinitionKey: "wo-stuffing",
              state: "completed",
              assignmentState: "unassigned",
              assigneeId: null,
              completedAt: "2026-09-13T03:00:00.000Z",
            },
          ],
          outcome: null,
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listClientOperations.mockResolvedValue({
      items: [
        {
          clientOperationId: "op-1",
          actionCode: "work_execution.complete_work_order",
          receptionState: "received",
          businessDecisionState: "accepted",
          commitState: "committed",
          rejectionReasonCode: null,
          resultRefs: [
            { entityType: "work_order", entityId: "w1" },
            { entityType: "node_task", entityId: "t1" },
          ],
          traceId: "trace-1",
          targetType: "work_order",
          targetId: "w1",
          createdAt: "2026-09-13T03:00:00.000Z",
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.containers.value[0]?.syncStatus.label).toBe("已入账");
    app.unmount();
  });

  it("货柜列表失败时只说没能加载", async () => {
    listContainers.mockRejectedValue(new Error("Failed to fetch"));
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.error.value).toBe("货柜没能加载");
    expect(catalog!.containers.value).toEqual([]);
    app.unmount();
  });

  it("任务接口失败时货柜仍在，不把待办标成已查空", async () => {
    listNodeTasks.mockRejectedValue(new Error("列节点任务失败"));
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.error.value).toBe("");
    expect(catalog!.tasksReady.value).toBe(false);
    expect(catalog!.containers.value[0]?.containerNumber).toBe("MSCU1");
    app.unmount();
  });

  it("操作接口失败时货柜仍在，不把同步标成已查空", async () => {
    listClientOperations.mockRejectedValue(new Error("列同步操作失败"));
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.error.value).toBe("");
    expect(catalog!.syncReady.value).toBe(false);
    expect(catalog!.containers.value[0]?.syncStatus.code).toBe("idle");
    app.unmount();
  });

  it("节点接口失败时货柜仍在，不把空轨假装成查过", async () => {
    listLifecycleNodesByContainers.mockRejectedValue(new Error("列节点失败"));
    let catalog: ReturnType<typeof useLiveCatalog> | undefined;
    const app = createApp({
      setup() {
        catalog = useLiveCatalog();
        return () => undefined;
      },
    });
    app.mount(document.createElement("div"));
    await catalog!.reload();
    await flushPromises();
    expect(catalog!.error.value).toBe("");
    expect(catalog!.railsReady.value).toBe(false);
    expect(catalog!.containers.value[0]?.rail).toEqual([]);
    app.unmount();
  });
});
