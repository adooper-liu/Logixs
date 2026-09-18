import type {
  OpsAssistantMessageRecord,
  OpsAssistantSessionRecord,
  OpsNotificationRecord,
} from "./domain/notification.types";

export const ASSISTANT_CONVERSATION = Symbol.for("logix.AssistantConversation");

export interface AssistantConversationPort {
  findVisibleNotification(input: {
    tenantId: string;
    notificationId: string;
    actorRoles: readonly string[];
  }): Promise<OpsNotificationRecord | null>;
  createSession(input: {
    tenantId: string;
    actorId: string;
    notificationId: string | null;
    containerId: string | null;
  }): Promise<OpsAssistantSessionRecord>;
  findSession(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
  }): Promise<OpsAssistantSessionRecord | null>;
  addMessage(input: {
    sessionId: string;
    role: OpsAssistantMessageRecord["role"];
    body: string;
  }): Promise<OpsAssistantMessageRecord>;
  listMessages(sessionId: string): Promise<OpsAssistantMessageRecord[]>;
}

export type {
  OpsAssistantMessageRecord as AssistantConversationMessage,
  OpsAssistantSessionRecord as AssistantConversationSession,
  OpsNotificationRecord as AssistantVisibleNotification,
};
