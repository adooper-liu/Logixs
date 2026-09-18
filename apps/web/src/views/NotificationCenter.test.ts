import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationCenter from "./NotificationCenter.vue";

const listNotifications = vi.fn();
const resolveNotificationTarget = vi.fn();
const openAssistantSession = vi.fn();

vi.mock("../api/notifications", () => ({
  listNotifications: (...args: unknown[]) => listNotifications(...args),
  resolveNotificationTarget: (...args: unknown[]) =>
    resolveNotificationTarget(...args),
  openAssistantSession: (...args: unknown[]) => openAssistantSession(...args),
  postAssistantMessage: vi.fn(),
}));

describe("NotificationCenter", () => {
  beforeEach(() => {
    listNotifications.mockReset();
    resolveNotificationTarget.mockReset();
    openAssistantSession.mockReset();
  });

  it("使用服务端确认的通知目标跳转", async () => {
    listNotifications.mockResolvedValue([
      {
        id: "n1",
        problemCode: "MISSING_DOCUMENT",
        severity: "warning",
        title: "资料缺失",
        body: "请补提单",
        entityType: "node_task",
        entityId: "t1",
        containerId: "c1",
        taskId: "t1",
        workOrderId: null,
        hasObjectTarget: true,
        recipientRoleCodes: ["operations_dispatcher"],
        conversationHint: null,
        occurredAt: "2026-09-18T08:00:00.000Z",
        createdAt: "2026-09-18T08:01:00.000Z",
      },
    ]);
    resolveNotificationTarget.mockResolvedValue({
      containerId: "c1",
      taskId: "t1",
      workOrderId: null,
      targetPath: "/tasks?containerId=c1&task=t1",
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/notifications", component: NotificationCenter },
        { path: "/tasks", component: { template: "<div>任务</div>" } },
      ],
    });
    await router.push("/notifications");
    await router.isReady();
    const wrapper = mount(NotificationCenter, {
      global: {
        plugins: [router],
        stubs: { PageHeader: { template: "<header />" } },
      },
    });
    await flushPromises();

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(resolveNotificationTarget).toHaveBeenCalledWith("n1");
    expect(router.currentRoute.value.fullPath).toBe(
      "/tasks?containerId=c1&task=t1",
    );
  });

  it("从通知打开带对象上下文的只读助手", async () => {
    listNotifications.mockResolvedValue([
      {
        id: "n1",
        problemCode: "MISSING_DOCUMENT",
        severity: "warning",
        title: "资料缺失",
        body: "请补提单",
        entityType: "container",
        entityId: "c1",
        containerId: "c1",
        taskId: null,
        workOrderId: null,
        hasObjectTarget: true,
        recipientRoleCodes: ["operations_dispatcher"],
        conversationHint: null,
        occurredAt: "2026-09-18T08:00:00.000Z",
        createdAt: "2026-09-18T08:01:00.000Z",
      },
    ]);
    openAssistantSession.mockResolvedValue({
      sessionId: "s1",
      notificationId: "n1",
      containerId: "c1",
      objectContext: {
        summary: {
          containerId: "c1",
          orderNumber: "SO-1",
          containerNumber: "MSKU1",
          currentStatus: "in_transit",
          currentNodeCode: "customs_clearance",
          flowState: "active",
          updatedAt: "2026-09-18T08:00:00.000Z",
        },
        allowedActions: [],
        actionSummary: "当前没有可执行的下一动作。",
        readOnlyPolicy: {
          assistantCanExecute: false,
          actorCanExecuteActions: false,
          explanation: "助手只解释现状。",
        },
      },
      messages: [],
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/notifications", component: NotificationCenter }],
    });
    await router.push("/notifications");
    await router.isReady();
    const wrapper = mount(NotificationCenter, {
      global: { plugins: [router], stubs: { PageHeader: true } },
    });
    await flushPromises();

    const askButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("询问助手"));
    await askButton?.trigger("click");
    await flushPromises();

    expect(openAssistantSession).toHaveBeenCalledWith({ notificationId: "n1" });
    expect(wrapper.text()).toContain("MSKU1");
    expect(wrapper.text()).toContain("当前没有可执行的下一动作");
  });
});
