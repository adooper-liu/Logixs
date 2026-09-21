import { formatHttpError } from "./httpError";

export interface ExternalWorkItem {
  id: string;
  sourceModule: string;
  sourceType: string;
  sourceRecordId: string;
  sourceVersion: number;
  containerId: string;
  taskDefinitionKey: string;
  title: string;
  detail: string;
  priority: "low" | "medium" | "high" | "critical";
  state: "open" | "completed" | "cancelled";
  assignedRoleCode: string;
  evidenceRefs: readonly string[];
  dueAt: string | null;
  createdAt: string;
}

export interface ExternalWorkItemPage {
  items: ExternalWorkItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

const IDENTITY_HEADERS = {
  "X-Tenant-Id": "dev-tenant",
  "X-Operator-Id": "dev-operator",
  "X-Roles": "field_operator",
};

export async function listExternalWorkItems(input?: {
  containerId?: string;
  pageSize?: number;
  cursor?: string;
}): Promise<ExternalWorkItemPage> {
  const query = new URLSearchParams();
  if (input?.containerId) query.set("containerId", input.containerId);
  if (input?.pageSize != null) query.set("pageSize", String(input.pageSize));
  if (input?.cursor) query.set("cursor", input.cursor);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`/api/work-items${suffix}`, {
    headers: IDENTITY_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载整改工作项失败",
      ),
    );
  }
  return (await response.json()) as ExternalWorkItemPage;
}
