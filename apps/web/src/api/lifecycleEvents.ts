import { requestApi } from "./httpClient";

export interface LifecycleEventItem {
  id: string;
  containerId: string;
  eventCode: string;
  occurredAt: string;
  recordedAt: string;
  evidenceRefs: string[];
}

export interface LifecycleEventPage {
  items: LifecycleEventItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

export async function listLifecycleEvents(
  containerId: string,
  query?: { pageSize?: number; cursor?: string },
): Promise<LifecycleEventPage> {
  const params = new URLSearchParams();
  if (query?.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query?.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await requestApi(
    `/api/containers/${encodeURIComponent(containerId)}/lifecycle-events${suffix}`,
    { fallback: `GET /api/containers/${containerId}/lifecycle-events failed` },
  );
  if (response.status === 404) {
    throw new Error("RESOURCE_NOT_FOUND");
  }
  if (!response.ok) {
    throw new Error(
      `GET /api/containers/${containerId}/lifecycle-events failed: ${response.status}`,
    );
  }
  return (await response.json()) as LifecycleEventPage;
}
