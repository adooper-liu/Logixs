export type NotificationSeverity = "low" | "medium" | "high" | "critical";

export interface OpsNotificationRecord {
  id: string;
  tenantId: string;
  problemCode: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  recipientRoleCodes: string[];
  conversationHint: string | null;
  createdAt: Date;
}

export interface CreateOpsNotificationInput {
  tenantId: string;
  problemCode: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  recipientRoleCodes: readonly string[];
  conversationHint?: string | null;
}

export interface OpsAssistantSessionRecord {
  id: string;
  tenantId: string;
  actorId: string;
  notificationId: string | null;
  createdAt: Date;
}

export interface OpsAssistantMessageRecord {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant";
  body: string;
  createdAt: Date;
}
