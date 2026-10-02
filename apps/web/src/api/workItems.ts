import { requestJson } from "./httpClient";

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
  return requestJson<ExternalWorkItemPage>(`/api/work-items${suffix}`, {
    fallback: "加载整改工作项失败",
  });
}
