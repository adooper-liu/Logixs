import { Inject, Injectable } from "@nestjs/common";
import type { AssistantConversationPort } from "../assistant-conversation.port";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";
import type { OpsAssistantMessageRecord } from "../domain/notification.types";

@Injectable()
export class AssistantConversationService implements AssistantConversationPort {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  findVisibleNotification(input: {
    tenantId: string;
    notificationId: string;
    actorRoles: readonly string[];
  }) {
    return this.notifications.findVisibleNotification({
      tenantId: input.tenantId,
      id: input.notificationId,
      actorRoles: input.actorRoles,
    });
  }

  createSession(input: {
    tenantId: string;
    actorId: string;
    notificationId: string | null;
    containerId: string | null;
  }) {
    return this.notifications.createSession(input);
  }

  findSession(input: { tenantId: string; actorId: string; sessionId: string }) {
    return this.notifications.findSession({
      tenantId: input.tenantId,
      actorId: input.actorId,
      id: input.sessionId,
    });
  }

  addMessage(input: {
    sessionId: string;
    role: OpsAssistantMessageRecord["role"];
    body: string;
  }) {
    return this.notifications.addMessage(input);
  }

  listMessages(sessionId: string) {
    return this.notifications.listMessages(sessionId);
  }
}
