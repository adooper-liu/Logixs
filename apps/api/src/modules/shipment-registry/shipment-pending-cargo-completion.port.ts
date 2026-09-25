import type { ShipmentPendingCargoCompletionCommandV1 } from "@logix/contracts";

export const SHIPMENT_PENDING_CARGO_COMPLETION = Symbol(
  "ShipmentPendingCargoCompletion",
);

export interface CompleteShipmentPendingCargoInput {
  tenantId: string;
  actorId: string;
  shipmentId: string;
  command: ShipmentPendingCargoCompletionCommandV1;
  evidenceRef: string;
  resolvedProductSkuIds: ReadonlyMap<string, string>;
  traceId: string;
}

export interface CompleteShipmentPendingCargoOutput {
  duplicate: boolean;
  relationshipVersion: number;
  cargoLineCount: number;
  unmatchedSkuCount: number;
  traceId: string;
}

export interface ShipmentPendingCargoCompletionPort {
  complete(
    input: CompleteShipmentPendingCargoInput,
  ): Promise<CompleteShipmentPendingCargoOutput>;
}

export class ShipmentPendingCargoCompletionConflictError extends Error {}
export class ShipmentPendingCargoCompletionNotFoundError extends Error {}
