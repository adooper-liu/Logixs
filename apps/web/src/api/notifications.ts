import { DEV_TENANT_ID } from "./developmentIdentity";

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

const DEV_OPERATOR_ID = "dev-operator";
const DEV_ROLES = "operations_dispatcher";

function devHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Tenant-Id": DEV_TENANT_ID,
    "X-Operator-Id": DEV_OPERATOR_ID,
    "X-Roles": DEV_ROLES,
  };
}

export async function listNotifications(
  limit = 50,
): Promise<OpsNotificationItem[]> {
  const response = await fetch(`/api/notifications?limit=${limit}`, {
    headers: devHeaders(),
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
  const response = await fetch(
    `/api/notification-targets/${encodeURIComponent(notificationId)}`,
    { headers: devHeaders() },
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
  const response = await fetch("/api/ops-assistant/sessions", {
    method: "POST",
    headers: devHeaders(),
    body: JSON.stringify(input),
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
  const response = await fetch(
    `/api/ops-assistant/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: devHeaders(),
      body: JSON.stringify({ body }),
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
