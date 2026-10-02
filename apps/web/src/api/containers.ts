import type { ContainerLifecycleState } from "@logix/contracts";
import { requestApi } from "./httpClient";

// 薄真实链路的前端只读 DTO：与 apps/api 的 ContainerSummary 形状一致。
export interface ContainerSummary {
  id: string;
  orderNumber: string | null;
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

export interface ContainerCargoScopeItem {
  replenishmentOrderLineId: string;
  productSkuId: string;
  productNumber: string;
  allocatedQuantity: string;
  quantityUnit: string;
}

export interface ContainerCargoScope {
  containerRecordId: string;
  allocationSetId: string | null;
  allocationSetVersion: number | null;
  items: readonly ContainerCargoScopeItem[];
}

export async function listContainers(query?: {
  pageSize?: number;
  cursor?: string;
}): Promise<ContainerPage> {
  const params = new URLSearchParams();
  if (query?.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query?.cursor) params.set("cursor", query.cursor);
  const queryString = params.toString();
  const suffix = queryString ? `?${queryString}` : "";
  const response = await requestApi(`/api/containers${suffix}`, {
    fallback: "GET /api/containers failed",
  });
  if (!response.ok) {
    throw new Error(`GET /api/containers failed: ${response.status}`);
  }
  return (await response.json()) as ContainerPage;
}

export async function getContainer(id: string): Promise<ContainerSummary> {
  const response = await requestApi(
    `/api/containers/${encodeURIComponent(id)}`,
    { fallback: `GET /api/containers/${id} failed` },
  );
  if (response.status === 404) {
    throw new Error("RESOURCE_NOT_FOUND");
  }
  if (!response.ok) {
    throw new Error(`GET /api/containers/${id} failed: ${response.status}`);
  }
  return (await response.json()) as ContainerSummary;
}

export async function getContainerCargo(
  id: string,
): Promise<ContainerCargoScope> {
  const response = await requestApi(
    `/api/containers/${encodeURIComponent(id)}/cargo`,
    { fallback: `GET /api/containers/${id}/cargo failed` },
  );
  if (!response.ok) {
    throw new Error(
      `GET /api/containers/${id}/cargo failed: ${response.status}`,
    );
  }
  return (await response.json()) as ContainerCargoScope;
}
