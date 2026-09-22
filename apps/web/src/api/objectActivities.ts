import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

export interface ObjectActivityItem {
  id: string;
  activityCode: string;
  sourceType: string;
  sourceId: string;
  occurredAt: string | null;
  recordedAt: string;
  containerId: string;
  taskId: string | null;
  workOrderId: string | null;
  actorId: string | null;
  nodeCode: string | null;
  title: string | null;
  detail: string | null;
  severity: string | null;
  targetPath: string | null;
}

export interface ObjectNextAction {
  actionCode: string;
  containerId: string;
  taskId: string;
  workOrderId: string;
  nodeCode: string;
  taskDefinitionKey: string;
  workOrderDefinitionKey: string;
  assignmentState: string;
  assigneeId: string | null;
  dueAt: string | null;
  targetPath: string;
}

export interface ObjectActivityPage {
  items: ObjectActivityItem[];
  nextActions: ObjectNextAction[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

const DEV_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

export async function listObjectActivities(
  containerId: string,
  query?: { pageSize?: number; cursor?: string },
): Promise<ObjectActivityPage> {
  const params = new URLSearchParams();
  if (query?.pageSize !== undefined) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query?.cursor) params.set("cursor", query.cursor);
  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetch(
    `/api/containers/${encodeURIComponent(containerId)}/activities${suffix}`,
    { headers: DEV_HEADERS },
  );
  if (response.status === 404) throw new Error("RESOURCE_NOT_FOUND");
  if (!response.ok) {
    throw new Error(
      formatHttpError(
        response.status,
        await response.text(),
        "加载对象动态失败",
      ),
    );
  }
  return (await response.json()) as ObjectActivityPage;
}
