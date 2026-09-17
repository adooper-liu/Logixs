import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";

@Injectable()
export class OpenAssistantSessionService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    notificationId?: string | null;
  }) {
    let seedBody: string | null = null;
    const notificationId: string | null = input.notificationId ?? null;

    if (notificationId) {
      const notification = await this.notifications.findNotification({
        tenantId: input.tenantId,
        id: notificationId,
      });
      if (!notification) throw new NotFoundException("NOTIFICATION_NOT_FOUND");
      seedBody = [
        `问题：${notification.title}`,
        notification.body,
        `对象：${notification.entityType}/${notification.entityId}`,
        notification.conversationHint
          ? `提示：${notification.conversationHint}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    }

    const session = await this.notifications.createSession({
      tenantId: input.tenantId,
      actorId: input.actorId,
      notificationId,
    });

    if (seedBody) {
      await this.notifications.addMessage({
        sessionId: session.id,
        role: "system",
        body: seedBody,
      });
    }

    const messages = await this.notifications.listMessages(session.id);
    return { session, messages };
  }
}
