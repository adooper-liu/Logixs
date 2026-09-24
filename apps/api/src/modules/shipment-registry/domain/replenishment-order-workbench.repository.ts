export const REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY = Symbol(
  "ReplenishmentOrderWorkbenchRepository",
);

export interface ReplenishmentOrderAllocationRecord {
  containerId: string;
  containerNumber: string | null;
  allocatedQuantity: string;
  quantityUnit: string;
}

export interface ReplenishmentOrderLineRecord {
  id: string;
  productSkuId: string | null;
  productNumber: string;
  shippedQuantity: string;
  quantityUnit: string;
  allocations: ReplenishmentOrderAllocationRecord[];
  handoffShipments: Array<{
    id: string;
    shipmentNumber: string | null;
    currentLifecycleStatus: string;
  }>;
}

export interface ReplenishmentOrderWorkbenchRecord {
  id: string;
  orderNumber: string;
  updatedAt: string;
  linkedContainers: Array<{ id: string; containerNumber: string | null }>;
  lines: ReplenishmentOrderLineRecord[];
  handoffShipments: Array<{
    id: string;
    shipmentNumber: string | null;
    currentLifecycleStatus: string;
  }>;
}

export interface ReplenishmentOrderWorkbenchRepository {
  list(input: {
    tenantId: string;
    after?: { updatedAt: Date; id: string };
    take: number;
  }): Promise<ReplenishmentOrderWorkbenchRecord[]>;
  resolveCurrentLines(input: {
    tenantId: string;
    identities: Array<{
      replenishmentOrderNumber: string;
      productNumber: string;
    }>;
  }): Promise<
    Array<{
      replenishmentOrderLineId: string;
      replenishmentOrderNumber: string;
      productSkuId: string | null;
      productNumber: string;
      sourceRowId: string;
    }>
  >;
}
