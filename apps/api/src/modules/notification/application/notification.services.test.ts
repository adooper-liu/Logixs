import { describe, expect, it, vi } from "vitest";
import { PostNotificationService } from "./post-notification.service";
import { OpenAssistantSessionService } from "./open-assistant-session.service";
import { PostAssistantMessageService } from "./post-assistant-message.service";
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
      recipientRoleCodes: ["operations_dispatcher"],
      conversationHint: null,
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

  it("opens a session seeded from a notification", async () => {
    const notification = {
      id: "n1",
      tenantId: "t1",
      problemCode: "outbox_dead_letter",
      severity: "high" as const,
      title: "死信",
      body: "投递失败",
      entityType: "outbox_message",
      entityId: "o1",
      recipientRoleCodes: ["operations_dispatcher"],
      conversationHint: "去看失败",
      createdAt: new Date(),
    };
    const session = {
      id: "s1",
      tenantId: "t1",
      actorId: "op-1",
      notificationId: "n1",
      createdAt: new Date(),
    };
    const repo = {
      findNotification: vi.fn().mockResolvedValue(notification),
      createSession: vi.fn().mockResolvedValue(session),
      addMessage: vi.fn().mockResolvedValue({
        id: "m1",
        sessionId: "s1",
        role: "system",
        body: "seed",
        createdAt: new Date(),
      }),
      listMessages: vi.fn().mockResolvedValue([
        {
          id: "m1",
          sessionId: "s1",
          role: "system",
          body: "seed",
          createdAt: new Date(),
        },
      ]),
    };
    const service = new OpenAssistantSessionService(repo as never);
    const result = await service.execute({
      tenantId: "t1",
      actorId: "op-1",
      notificationId: "n1",
    });
    expect(repo.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "s1",
        role: "system",
      }),
    );
    expect(result.session.id).toBe("s1");
    expect(result.messages).toHaveLength(1);
  });

  it("posts a user message and stores an assistant reply", async () => {
    const repo = {
      findSession: vi.fn().mockResolvedValue({
        id: "s1",
        tenantId: "t1",
        actorId: "op-1",
        notificationId: "n1",
        createdAt: new Date(),
      }),
      findNotification: vi.fn().mockResolvedValue({
        id: "n1",
        problemCode: "outbox_dead_letter",
        title: "死信",
        body: "失败",
      }),
      addMessage: vi.fn().mockResolvedValue({}),
      listMessages: vi
        .fn()
        .mockResolvedValueOnce([
          { id: "m1", sessionId: "s1", role: "user", body: "怎么处理？" },
        ])
        .mockResolvedValueOnce([
          { id: "m1", sessionId: "s1", role: "user", body: "怎么处理？" },
          {
            id: "m2",
            sessionId: "s1",
            role: "assistant",
            body: "只读摘要",
          },
        ]),
    };
    const aiGateway = {
      answerOpsQuestion: vi.fn().mockResolvedValue("只读摘要"),
    };
    const service = new PostAssistantMessageService(
      repo as never,
      aiGateway as never,
    );
    const messages = await service.execute({
      tenantId: "t1",
      actorId: "op-1",
      sessionId: "s1",
      body: "怎么处理？",
    });
    expect(aiGateway.answerOpsQuestion).toHaveBeenCalled();
    expect(messages.at(-1)?.role).toBe("assistant");
  });
});
