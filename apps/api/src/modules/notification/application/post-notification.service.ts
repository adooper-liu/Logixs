import { Inject, Injectable } from "@nestjs/common";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";
import type {
  PostNotificationInput,
  PostNotificationPort,
} from "../post-notification.port";

@Injectable()
export class PostNotificationService implements PostNotificationPort {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  execute(input: PostNotificationInput) {
    return this.notifications.createNotification({
      ...input,
      conversationHint: input.conversationHint ?? null,
    });
  }
}
