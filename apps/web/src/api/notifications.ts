export interface OpsNotificationItem {
  id: string;
  problemCode: string;
  severity: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  recipientRoleCodes: string[];
  conversationHint: string | null;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  role: string;
  body: string;
  createdAt: string;
}

export interface AssistantSession {
  sessionId: string;
  notificationId: string | null;
  messages: AssistantMessage[];
}

const DEV_TENANT_ID = "dev-tenant";
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

export async function openAssistantSession(
  notificationId?: string,
): Promise<AssistantSession> {
  const response = await fetch("/api/ops-assistant/sessions", {
    method: "POST",
    headers: devHeaders(),
    body: JSON.stringify(notificationId ? { notificationId } : {}),
  });
  if (!response.ok) {
    throw new Error(
      `POST /api/ops-assistant/sessions failed: ${response.status}`,
    );
  }
  return (await response.json()) as AssistantSession;
}

export async function postAssistantMessage(
  sessionId: string,
  body: string,
): Promise<AssistantSession> {
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
  return (await response.json()) as AssistantSession;
}
