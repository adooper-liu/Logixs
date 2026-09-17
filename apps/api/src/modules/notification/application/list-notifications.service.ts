import { Inject, Injectable } from "@nestjs/common";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";

@Injectable()
export class ListNotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  execute(input: {
    tenantId: string;
    actorRoles: readonly string[];
    limit?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    return this.notifications.listNotifications({
      tenantId: input.tenantId,
      actorRoles: input.actorRoles,
      limit,
    });
  }
}
