export const RESOLVE_REPLENISHMENT_ORDER_LINES = Symbol(
  "ResolveReplenishmentOrderLines",
);

export interface ReplenishmentOrderLineIdentity {
  replenishmentOrderNumber: string;
  productNumber: string;
}

export interface ResolvedReplenishmentOrderLine extends ReplenishmentOrderLineIdentity {
  replenishmentOrderLineId: string;
  productSkuId: string | null;
  sourceRowId: string;
}

export interface ResolveReplenishmentOrderLinesPort {
  execute(input: {
    tenantId: string;
    identities: ReplenishmentOrderLineIdentity[];
  }): Promise<ResolvedReplenishmentOrderLine[]>;
}
