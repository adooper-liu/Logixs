import type { ContainerLifecycleState } from "@logix/contracts";

// 薄真实链路的前端只读 DTO：与 apps/api 的 ContainerSummary 形状一致。
export interface ContainerSummary {
  id: string;
  orderNumber: string;
  containerNumber: string | null;
  currentStatus: ContainerLifecycleState;
  updatedAt: string;
}

export async function listContainers(): Promise<ContainerSummary[]> {
  const response = await fetch("/api/containers");
  if (!response.ok) {
    throw new Error(`GET /api/containers failed: ${response.status}`);
  }
  return (await response.json()) as ContainerSummary[];
}
