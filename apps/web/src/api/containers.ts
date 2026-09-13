import type { ContainerLifecycleState } from "@logix/contracts";

// 薄真实链路的前端只读 DTO：与 apps/api 的 ContainerSummary 形状一致。
export interface ContainerSummary {
  id: string;
  orderNumber: string;
  containerNumber: string | null;
  currentStatus: ContainerLifecycleState;
  updatedAt: string;
}

export interface ContainerPage {
  items: ContainerSummary[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

// 开发期身份与导入写路径对齐（正式 OIDC 属 P5-02）。
const DEV_TENANT_ID = "dev-tenant";
const DEV_OPERATOR_ID = "dev-operator";

export async function listContainers(): Promise<ContainerPage> {
  const response = await fetch("/api/containers", {
    headers: {
      "X-Tenant-Id": DEV_TENANT_ID,
      "X-Operator-Id": DEV_OPERATOR_ID,
    },
  });
  if (!response.ok) {
    throw new Error(`GET /api/containers failed: ${response.status}`);
  }
  return (await response.json()) as ContainerPage;
}
