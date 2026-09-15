import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MicroWorkbench from "./MicroWorkbench.vue";

const getContainer = vi.fn();
const listLifecycleEvents = vi.fn();
const listLifecycleNodes = vi.fn();
const listNodeTasks = vi.fn();
const listClientOperations = vi.fn();

vi.mock("../api/containers", () => ({
  getContainer: (...args: unknown[]) => getContainer(...args),
}));

vi.mock("../api/lifecycleEvents", () => ({
  listLifecycleEvents: (...args: unknown[]) => listLifecycleEvents(...args),
}));

vi.mock("../api/lifecycleNodes", () => ({
  listLifecycleNodes: (...args: unknown[]) => listLifecycleNodes(...args),
}));

vi.mock("../api/nodeTasks", () => ({
  listNodeTasks: (...args: unknown[]) => listNodeTasks(...args),
}));

vi.mock("../api/clientOperations", () => ({
  listClientOperations: (...args: unknown[]) => listClientOperations(...args),
}));

async function mountPage(id: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/container/:containerRecordId",
        component: MicroWorkbench,
      },
      { path: "/tasks", component: { template: "<div />" } },
      { path: "/containers", component: { template: "<div />" } },
    ],
  });
  await router.push(`/container/${id}`);
  await router.isReady();
  const wrapper = mount(MicroWorkbench, {
    global: {
      plugins: [router],
      stubs: {
        PageHeader: {
          props: ["title", "eyebrow"],
          template: "<header><h2>{{ title }}</h2></header>",
        },
        ObjectContextBar: {
          props: ["record"],
          template:
            "<section>{{ record.containerNumber }}<span v-if=\"record.taskStatus.code !== 'idle'\">{{ record.taskStatus.label }}</span><span v-if=\"record.syncStatus.code !== 'idle'\">{{ record.syncStatus.label }}</span></section>",
        },
        EventEvidenceTimeline: {
          props: ["events"],
          template:
            '<section aria-label="事件时间证据">{{ events[0]?.label }}</section>',
        },
        LiveNodeRail: {
          props: ["nodes"],
          template:
            '<nav aria-label="货柜节点">{{ nodes[0]?.name }} {{ nodes[0]?.stateLabel }}</nav>',
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("MicroWorkbench", () => {
  beforeEach(() => {
    getContainer.mockReset();
    listLifecycleEvents.mockReset();
    listLifecycleNodes.mockReset();
    listNodeTasks.mockReset();
    listClientOperations.mockReset();
    listNodeTasks.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listClientOperations.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listLifecycleNodes.mockResolvedValue({
      flow: null,
      nodes: [],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    listLifecycleEvents.mockResolvedValue({
      items: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
  });

  it("按 id 读取摘要并链到任务台", async () => {
    getContainer.mockResolvedValue({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
    const wrapper = await mountPage("c1");
    expect(getContainer).toHaveBeenCalledWith("c1");
    expect(listLifecycleNodes).toHaveBeenCalledWith("c1");
    expect(listLifecycleEvents).toHaveBeenCalledWith("c1", { pageSize: 200 });
    expect(listNodeTasks).toHaveBeenCalledWith({
      containerId: "c1",
      pageSize: 200,
    });
    expect(listClientOperations).toHaveBeenCalledWith({ pageSize: 200 });
    expect(wrapper.text()).toContain("MSKU1");
    expect(wrapper.text()).not.toContain("无投影");
    expect(wrapper.text()).toContain("本柜尚未开始流程。");
    expect(wrapper.text()).not.toContain("待发生");
    expect(wrapper.get("a").attributes("href")).toBe("/tasks?containerId=c1");
  });

  it("有节点实例时展示轨道，不补未落库站点", async () => {
    getContainer.mockResolvedValue({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
    listLifecycleNodes.mockResolvedValue({
      flow: {
        id: "f1",
        state: "active",
        currentNodeCode: "cargo_ready",
        version: 0,
      },
      nodes: [
        {
          nodeInstanceId: "n1",
          nodeCode: "cargo_ready",
          sequence: 1,
          state: "active",
          applicability: "required",
          completedAt: null,
          isCurrent: true,
        },
      ],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    const wrapper = await mountPage("c1");
    expect(wrapper.text()).toContain("备货");
    expect(wrapper.text()).toContain("进行中");
    expect(wrapper.text()).toContain("本柜尚无操作记录。");
    expect(wrapper.text()).not.toContain("本柜尚未开始流程。");
    expect(wrapper.text()).not.toContain("待发生");
    expect(wrapper.text()).not.toContain("海运在途");
  });

  it("有规范事件时展示时间轴，不编造计划时间", async () => {
    getContainer.mockResolvedValue({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
    listLifecycleEvents.mockResolvedValue({
      items: [
        {
          id: "e1",
          containerId: "c1",
          eventCode: "departed",
          occurredAt: "2026-09-13T03:00:00.000Z",
          recordedAt: "2026-09-13T03:01:00.000Z",
          evidenceRefs: ["ev-1"],
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    const wrapper = await mountPage("c1");
    expect(wrapper.text()).toContain("离港/离站");
    expect(wrapper.text()).toContain("去做这柜的任务");
    expect(wrapper.text()).not.toContain("这一柜还没有节点记录。");
    expect(wrapper.text()).toContain("本柜尚未开始流程。");
    expect(wrapper.text()).not.toContain("最近操作已落账");
    expect(wrapper.text()).not.toContain("已落账");
  });

  it("有待办或最近提交时对象头露出，失败不挡档案", async () => {
    getContainer.mockResolvedValue({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
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
    const shown = await mountPage("c1");
    expect(shown.text()).toContain("装箱完成 · 进行中");
    expect(shown.text()).toContain("已入账");
    expect(shown.text()).not.toContain("无投影");
    shown.unmount();

    listNodeTasks.mockRejectedValue(new Error("列节点任务失败"));
    listClientOperations.mockRejectedValue(new Error("列同步操作失败"));
    const failed = await mountPage("c1");
    expect(failed.text()).toContain("MSKU1");
    expect(failed.text()).not.toContain("装箱完成");
    expect(failed.text()).not.toContain("已入账");
    expect(failed.text()).not.toContain("无投影");
    expect(failed.text()).not.toContain("加载失败");
  });

  it("读柜失败只说货柜没能加载", async () => {
    getContainer.mockRejectedValue(new Error("Failed to fetch"));
    const wrapper = await mountPage("c1");
    expect(wrapper.text()).toContain("货柜没能加载");
    expect(wrapper.text()).not.toContain("Failed to fetch");
    expect(wrapper.text()).not.toContain("加载失败");
  });

  it("不存在显示未找到，不扫列表", async () => {
    getContainer.mockRejectedValue(new Error("RESOURCE_NOT_FOUND"));
    const wrapper = await mountPage("missing");
    expect(wrapper.text()).toContain("找不到这只货柜");
    expect(wrapper.text()).toContain("missing");
    expect(wrapper.text()).not.toContain("MSKU1");
  });
});
