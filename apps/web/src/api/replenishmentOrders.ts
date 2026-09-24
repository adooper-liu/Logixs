import { DEV_TENANT_ID } from "./developmentIdentity";

export type ReplenishmentWorkReasonCode =
  | "complete_order_lines"
  | "confirm_sku_identity"
  | "complete_product_profile"
  | "allocate_cargo"
  | "ready_for_container_review"
  | "waiting_other";

export interface ReplenishmentLineGap {
  code: string;
  label: string;
}

export interface ReplenishmentOrderAllocation {
  containerId: string;
  containerNumber: string | null;
  allocatedQuantity: string;
  quantityUnit: string;
}

export interface ReplenishmentProductProfile {
  profileId: string;
  version: number;
  verificationState: string;
  sourceSystem: string;
  createdAt: string;
  battery: { presenceState: string; packingMode: string | null };
  refrigerant: { presenceState: string };
  dangerousGoods: { classificationState: string };
  inspectionRequirements: Array<{
    requirementType: string;
    requirementState: string;
    jurisdictionCountryCode: string | null;
  }>;
}

export interface ReplenishmentOrderLine {
  id: string;
  productSkuId: string | null;
  productNumber: string;
  shippedQuantity: string;
  quantityUnit: string;
  allocatedQuantity: string;
  unallocatedQuantity: string;
  allocations: ReplenishmentOrderAllocation[];
  profile: ReplenishmentProductProfile | null;
  gaps: ReplenishmentLineGap[];
}

export interface ReplenishmentOrderWorkbenchItem {
  id: string;
  orderNumber: string;
  updatedAt: string;
  workReason: {
    code: ReplenishmentWorkReasonCode;
    label: string;
    detail: string;
    responsibility: "mine" | "waiting_other";
  };
  nextAction: { code: string; label: string } | null;
  relatedContainers: Array<{ id: string; containerNumber: string | null }>;
  lines: ReplenishmentOrderLine[];
}

export interface ReplenishmentOrderPage {
  items: ReplenishmentOrderWorkbenchItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: string;
  projectionVersion: number;
}

export async function listReplenishmentOrders(query?: {
  pageSize?: number;
  cursor?: string;
}): Promise<ReplenishmentOrderPage> {
  const params = new URLSearchParams();
  if (query?.pageSize != null) params.set("pageSize", String(query.pageSize));
  if (query?.cursor) params.set("cursor", query.cursor);
  const queryString = params.toString();
  const response = await fetch(
    `/api/replenishment-orders${queryString ? `?${queryString}` : ""}`,
    {
      headers: {
        "X-Tenant-Id": DEV_TENANT_ID,
        "X-Operator-Id": "dev-operator",
        "X-Roles": "operations_dispatcher",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GET /api/replenishment-orders failed: ${response.status}`);
  }
  return (await response.json()) as ReplenishmentOrderPage;
}
