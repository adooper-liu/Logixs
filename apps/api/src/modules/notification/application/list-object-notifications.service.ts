import { Inject, Injectable } from "@nestjs/common";
import type { ListObjectNotificationsPort } from "../list-object-notifications.port";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from "../domain/notification.repository";

@Injectable()
export class ListObjectNotificationsService implements ListObjectNotificationsPort {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {}

  execute(input: {
    tenantId: string;
    containerId: string;
    actorRoles: readonly string[];
    atOrBefore: Date;
    take: number;
  }) {
    return this.notifications.listObjectNotifications(input);
  }

  findVisible(input: {
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
}
