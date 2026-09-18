import { describe, expect, it, vi } from "vitest";
import { PostNotificationService } from "./post-notification.service";
import { ListNotificationsService } from "./list-notifications.service";

describe("notification application services", () => {
  it("posts and lists notifications for matching roles", async () => {
    const created = {
      id: "n1",
      tenantId: "t1",
      problemCode: "outbox_dead_letter",
      severity: "high" as const,
      title: "死信",
      body: "失败",
      entityType: "outbox_message",
      entityId: "o1",
      containerId: null,
      taskId: null,
      workOrderId: null,
      recipientRoleCodes: ["operations_dispatcher"],
      conversationHint: null,
      occurredAt: new Date("2026-09-17T00:00:00.000Z"),
      createdAt: new Date("2026-09-17T00:00:00.000Z"),
    };
    const repo = {
      createNotification: vi.fn().mockResolvedValue(created),
      listNotifications: vi.fn().mockResolvedValue([created]),
    };
    const post = new PostNotificationService(repo as never);
    const list = new ListNotificationsService(repo as never);

    await expect(
      post.execute({
        tenantId: "t1",
        problemCode: "outbox_dead_letter",
        severity: "high",
        title: "死信",
        body: "失败",
        entityType: "outbox_message",
        entityId: "o1",
        occurredAt: new Date("2026-09-17T00:00:00.000Z"),
        recipientRoleCodes: ["operations_dispatcher"],
      }),
    ).resolves.toEqual(created);

    await expect(
      list.execute({
        tenantId: "t1",
        actorRoles: ["operations_dispatcher"],
      }),
    ).resolves.toEqual([created]);
  });
});
