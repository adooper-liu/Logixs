export interface LifecycleNodeTimes {
  plannedAt: string | null;
  estimatedAt: string | null;
  actualAt: string | null;
}

export interface LifecycleNodeItem {
  nodeInstanceId: string;
  nodeCode: string;
  sequence: number;
  state: string;
  applicability: string;
  completedAt: string | null;
  blockedReasonRefs: string[];
  isCurrent: boolean;
  times: LifecycleNodeTimes;
}

export interface LifecycleNodesPage {
  flow: {
    id: string;
    state: string;
    currentNodeCode: string;
    version: number;
  } | null;
  nodes: LifecycleNodeItem[];
  asOf: string;
  projectionVersion: number;
}

const DEV_TENANT_ID = "dev-tenant";
const DEV_OPERATOR_ID = "dev-operator";

export interface ContainerLifecycleNodesItem {
  containerId: string;
  flow: LifecycleNodesPage["flow"];
  nodes: LifecycleNodeItem[];
}

export interface ContainerLifecycleNodesPage {
  items: ContainerLifecycleNodesItem[];
  asOf: string;
  projectionVersion: number;
}

export async function listLifecycleNodesByContainers(
  containerIds: readonly string[],
): Promise<ContainerLifecycleNodesPage> {
  const ids = containerIds.map((id) => id.trim()).filter(Boolean);
  const query = new URLSearchParams();
  query.set("containerIds", ids.join(","));
  const response = await fetch(`/api/lifecycle-nodes?${query.toString()}`, {
    headers: {
      "X-Tenant-Id": DEV_TENANT_ID,
      "X-Operator-Id": DEV_OPERATOR_ID,
    },
  });
  if (!response.ok) {
    throw new Error(`GET /api/lifecycle-nodes failed: ${response.status}`);
  }
  return (await response.json()) as ContainerLifecycleNodesPage;
}

export async function listLifecycleNodes(
  containerId: string,
): Promise<LifecycleNodesPage> {
  const response = await fetch(
    `/api/containers/${encodeURIComponent(containerId)}/lifecycle-nodes`,
    {
      headers: {
        "X-Tenant-Id": DEV_TENANT_ID,
        "X-Operator-Id": DEV_OPERATOR_ID,
      },
    },
  );
  if (response.status === 404) {
    throw new Error("RESOURCE_NOT_FOUND");
  }
  if (!response.ok) {
    throw new Error(
      `GET /api/containers/${containerId}/lifecycle-nodes failed: ${response.status}`,
    );
  }
  return (await response.json()) as LifecycleNodesPage;
}
