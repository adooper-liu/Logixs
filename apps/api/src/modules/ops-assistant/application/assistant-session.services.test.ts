import { describe, expect, it, vi } from "vitest";
import { OpenAssistantSessionService } from "./open-assistant-session.service";
import { PostAssistantMessageService } from "./post-assistant-message.service";

const CONTEXT = {
  summary: {
    containerId: "container-1",
    orderNumber: "SO-1",
    containerNumber: "MSKU1",
    currentStatus: "in_transit" as const,
    currentNodeCode: "customs_clearance" as const,
    flowState: "active" as const,
    updatedAt: "2026-09-18T01:00:00.000Z",
  },
  allowedActions: [],
  actionSummary: "当前没有可执行的下一动作。",
  readOnlyPolicy: {
    assistantCanExecute: false as const,
    actorCanExecuteActions: false,
    explanation: "助手只解释现状。",
  },
};

describe("assistant session services", () => {
  it("opens from a role-visible notification and persists its object reference", async () => {
    const conversations = {
      findVisibleNotification: vi.fn().mockResolvedValue({
        id: "notification-1",
        title: "资料缺失",
        body: "请补提单",
        conversationHint: null,
        containerId: "container-1",
        taskId: "task-1",
        workOrderId: null,
      }),
      createSession: vi.fn().mockResolvedValue({
        id: "session-1",
        notificationId: "notification-1",
        containerId: "container-1",
      }),
      addMessage: vi.fn().mockResolvedValue({}),
      listMessages: vi.fn().mockResolvedValue([]),
    };
    const objectContext = {
      execute: vi.fn().mockResolvedValue(CONTEXT),
      assertNotificationReference: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OpenAssistantSessionService(
      conversations as never,
      objectContext as never,
    );

    const result = await service.execute({
      tenantId: "tenant-1",
      actorId: "operator-1",
      actorRoles: ["operations_dispatcher"],
      actorCapabilities: ["container.read", "task.read"],
      notificationId: "notification-1",
    });

    expect(conversations.findVisibleNotification).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      notificationId: "notification-1",
      actorRoles: ["operations_dispatcher"],
    });
    expect(conversations.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ containerId: "container-1" }),
    );
    expect(result.objectContext).toBe(CONTEXT);
  });

  it("rejects an invisible notification before creating a session", async () => {
    const conversations = {
      findVisibleNotification: vi.fn().mockResolvedValue(null),
      createSession: vi.fn(),
    };
    const service = new OpenAssistantSessionService(
      conversations as never,
      { execute: vi.fn() } as never,
    );
    await expect(
      service.execute({
        tenantId: "tenant-1",
        actorId: "operator-1",
        actorRoles: ["manager"],
        actorCapabilities: ["container.read"],
        notificationId: "notification-1",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(conversations.createSession).not.toHaveBeenCalled();
  });

  it("rebuilds current object context before asking AI", async () => {
    const now = new Date("2026-09-18T02:00:00.000Z");
    const conversations = {
      findSession: vi.fn().mockResolvedValue({
        id: "session-1",
        notificationId: null,
        containerId: "container-1",
      }),
      addMessage: vi.fn().mockResolvedValue({}),
      listMessages: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: "message-1",
            role: "user",
            body: "下一步是什么？",
            createdAt: now,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "message-1",
            role: "user",
            body: "下一步是什么？",
            createdAt: now,
          },
          {
            id: "message-2",
            role: "assistant",
            body: "去任务工作台处理。",
            createdAt: now,
          },
        ]),
    };
    const aiGateway = {
      answerOpsQuestion: vi.fn().mockResolvedValue("去任务工作台处理。"),
    };
    const objectContext = { execute: vi.fn().mockResolvedValue(CONTEXT) };
    const service = new PostAssistantMessageService(
      conversations as never,
      aiGateway as never,
      objectContext as never,
    );

    const result = await service.execute({
      tenantId: "tenant-1",
      actorId: "operator-1",
      actorRoles: ["operations_dispatcher"],
      actorCapabilities: ["container.read", "task.read"],
      sessionId: "session-1",
      body: "下一步是什么？",
    });

    expect(objectContext.execute).toHaveBeenCalledWith(
      expect.objectContaining({ containerId: "container-1" }),
    );
    expect(aiGateway.answerOpsQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ objectContext: CONTEXT }),
    );
    expect(result.containerId).toBe("container-1");
    expect(result.messages.at(-1)?.role).toBe("assistant");
  });
});
