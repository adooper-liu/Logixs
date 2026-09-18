import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationCenter from "./NotificationCenter.vue";

const listNotifications = vi.fn();
const resolveNotificationTarget = vi.fn();

vi.mock("../api/notifications", () => ({
  listNotifications: (...args: unknown[]) => listNotifications(...args),
  resolveNotificationTarget: (...args: unknown[]) =>
    resolveNotificationTarget(...args),
  openAssistantSession: vi.fn(),
  postAssistantMessage: vi.fn(),
}));

describe("NotificationCenter", () => {
  beforeEach(() => {
    listNotifications.mockReset();
    resolveNotificationTarget.mockReset();
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
});
