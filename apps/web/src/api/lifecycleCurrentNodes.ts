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

const DEV_TENANT_ID = "dev-tenant";
const DEV_OPERATOR_ID = "dev-operator";

export async function listCurrentNodes(
  containerIds: readonly string[],
): Promise<ContainerCurrentNodesPage> {
  const ids = containerIds.map((id) => id.trim()).filter(Boolean);
  const query = new URLSearchParams();
  query.set("containerIds", ids.join(","));
  const response = await fetch(
    `/api/lifecycle-current-nodes?${query.toString()}`,
    {
      headers: {
        "X-Tenant-Id": DEV_TENANT_ID,
        "X-Operator-Id": DEV_OPERATOR_ID,
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `GET /api/lifecycle-current-nodes failed: ${response.status}`,
    );
  }
  return (await response.json()) as ContainerCurrentNodesPage;
}
