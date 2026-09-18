import type { OpsNotificationRecord } from "./domain/notification.types";

export const LIST_OBJECT_NOTIFICATIONS = Symbol.for(
  "logix.ListObjectNotifications",
);

export interface ListObjectNotificationsPort {
  execute(input: {
    tenantId: string;
    containerId: string;
    actorRoles: readonly string[];
    atOrBefore: Date;
    take: number;
  }): Promise<OpsNotificationRecord[]>;
  findVisible(input: {
    tenantId: string;
    notificationId: string;
    actorRoles: readonly string[];
  }): Promise<OpsNotificationRecord | null>;
}
