import { describe, expect, it, vi } from "vitest";
import { AssistantConversationService } from "./assistant-conversation.service";

describe("AssistantConversationService", () => {
  it("delegates visible notification and actor-owned session access", async () => {
    const notification = { id: "notification-1" };
    const session = { id: "session-1", containerId: "container-1" };
    const repository = {
      findVisibleNotification: vi.fn().mockResolvedValue(notification),
      createSession: vi.fn().mockResolvedValue(session),
      findSession: vi.fn().mockResolvedValue(session),
      addMessage: vi.fn().mockResolvedValue({ id: "message-1" }),
      listMessages: vi.fn().mockResolvedValue([]),
    };
    const service = new AssistantConversationService(repository as never);

    await expect(
      service.findVisibleNotification({
        tenantId: "tenant-1",
        notificationId: "notification-1",
        actorRoles: ["operations_dispatcher"],
      }),
    ).resolves.toBe(notification);
    await expect(
      service.createSession({
        tenantId: "tenant-1",
        actorId: "operator-1",
        notificationId: "notification-1",
        containerId: "container-1",
      }),
    ).resolves.toBe(session);
    await expect(
      service.findSession({
        tenantId: "tenant-1",
        actorId: "operator-1",
        sessionId: "session-1",
      }),
    ).resolves.toBe(session);

    expect(repository.findVisibleNotification).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      id: "notification-1",
      actorRoles: ["operations_dispatcher"],
    });
    expect(repository.findSession).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "operator-1",
      id: "session-1",
    });
  });
});
