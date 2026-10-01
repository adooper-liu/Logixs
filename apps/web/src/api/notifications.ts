import { requestApi } from "./httpClient";

export interface OpsNotificationItem {
  id: string;
  problemCode: string;
  severity: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  containerId: string | null;
  taskId: string | null;
  workOrderId: string | null;
  hasObjectTarget: boolean;
  recipientRoleCodes: string[];
  conversationHint: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface NotificationTarget {
  containerId: string;
  taskId: string | null;
  workOrderId: string | null;
  targetPath: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listNotifications(
  limit = 50,
): Promise<OpsNotificationItem[]> {
  const response = await requestApi(`/api/notifications?limit=${limit}`, {
    fallback: "GET /api/notifications failed",
  });
  if (!response.ok) {
    throw new Error(`GET /api/notifications failed: ${response.status}`);
  }
  const data = (await response.json()) as { items: OpsNotificationItem[] };
  return data.items;
}

export async function resolveNotificationTarget(
  notificationId: string,
): Promise<NotificationTarget> {
  const response = await requestApi(
    `/api/notification-targets/${encodeURIComponent(notificationId)}`,
    { fallback: `GET /api/notification-targets/${notificationId} failed` },
  );
  if (response.status === 404) throw new Error("RESOURCE_NOT_FOUND");
  if (!response.ok) {
    throw new Error(
      `GET /api/notification-targets/${notificationId} failed: ${response.status}`,
    );
  }
  return (await response.json()) as NotificationTarget;
}

export async function openAssistantSession(
  input: OpenAssistantSessionRequest = {},
): Promise<AssistantSessionResponse> {
  const response = await requestApi("/api/ops-assistant/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
    fallback: "POST /api/ops-assistant/sessions failed",
  });
  if (!response.ok) {
    throw new Error(
      `POST /api/ops-assistant/sessions failed: ${response.status}`,
    );
  }
  return (await response.json()) as AssistantSessionResponse;
}

export async function postAssistantMessage(
  sessionId: string,
  body: string,
): Promise<AssistantSessionResponse> {
  const response = await requestApi(
    `/api/ops-assistant/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ body }),
      fallback: `POST /api/ops-assistant/sessions/${sessionId}/messages failed`,
    },
  );
  if (!response.ok) {
    throw new Error(
      `POST /api/ops-assistant/sessions/${sessionId}/messages failed: ${response.status}`,
    );
  }
  return (await response.json()) as AssistantSessionResponse;
}

export type {
  AssistantMessage,
  AssistantObjectContext,
  AssistantSessionResponse,
  OpenAssistantSessionRequest,
} from "@logix/contracts";
import type {
  AssistantSessionResponse,
  OpenAssistantSessionRequest,
} from "@logix/contracts";
