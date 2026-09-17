import type {
  CreateOpsNotificationInput,
  OpsAssistantMessageRecord,
  OpsAssistantSessionRecord,
  OpsNotificationRecord,
} from "./notification.types";

export const NOTIFICATION_REPOSITORY = Symbol("NotificationRepository");

export interface NotificationRepository {
  createNotification(
    input: CreateOpsNotificationInput,
  ): Promise<OpsNotificationRecord>;
  listNotifications(query: {
    tenantId: string;
    actorRoles: readonly string[];
    limit: number;
  }): Promise<OpsNotificationRecord[]>;
  findNotification(query: {
    tenantId: string;
    id: string;
  }): Promise<OpsNotificationRecord | null>;
  createSession(input: {
    tenantId: string;
    actorId: string;
    notificationId: string | null;
  }): Promise<OpsAssistantSessionRecord>;
  findSession(query: {
    tenantId: string;
    actorId: string;
    id: string;
  }): Promise<OpsAssistantSessionRecord | null>;
  addMessage(input: {
    sessionId: string;
    role: OpsAssistantMessageRecord["role"];
    body: string;
  }): Promise<OpsAssistantMessageRecord>;
  listMessages(sessionId: string): Promise<OpsAssistantMessageRecord[]>;
}
