import { requestApi } from "./httpClient";

export interface ContainerCurrentNodeItem {
  containerId: string;
  currentNodeCode: string;
  flowState: string;
}

export interface ContainerCurrentNodesPage {
  items: ContainerCurrentNodeItem[];
  asOf: string;
  projectionVersion: number;
}

export async function listCurrentNodes(
  containerIds: readonly string[],
): Promise<ContainerCurrentNodesPage> {
  const ids = containerIds.map((id) => id.trim()).filter(Boolean);
  const query = new URLSearchParams();
  query.set("containerIds", ids.join(","));
  const response = await requestApi(
    `/api/lifecycle-current-nodes?${query.toString()}`,
    { fallback: "GET /api/lifecycle-current-nodes failed" },
  );
  if (!response.ok) {
    throw new Error(
      `GET /api/lifecycle-current-nodes failed: ${response.status}`,
    );
  }
  return (await response.json()) as ContainerCurrentNodesPage;
}
