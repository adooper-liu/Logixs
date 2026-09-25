import type { ShipmentPendingSkuBindingCommandV1 } from "@logix/contracts";

export const SHIPMENT_PENDING_SKU_BINDING = Symbol("ShipmentPendingSkuBinding");

export interface BindShipmentPendingSkuInput {
  tenantId: string;
  actorId: string;
  shipmentId: string;
  command: ShipmentPendingSkuBindingCommandV1;
  productSkuId: string;
  productNumber: string;
  skuResolution: "matched_existing" | "registered";
  traceId: string;
}

export interface BindShipmentPendingSkuOutput {
  duplicate: boolean;
  relationshipVersion: number;
  cargoLineVersion: number;
  skuResolution: "matched_existing" | "registered";
  traceId: string;
}

export interface ShipmentPendingSkuBindingPort {
  bind(
    input: BindShipmentPendingSkuInput,
  ): Promise<BindShipmentPendingSkuOutput>;
}

export class ShipmentPendingSkuBindingConflictError extends Error {}
export class ShipmentPendingSkuBindingNotFoundError extends Error {}
