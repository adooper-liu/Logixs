import type { ShipmentPendingFactCompletionCommandV1 } from "@logix/contracts";

export const SHIPMENT_PENDING_FACT_COMPLETION = Symbol(
  "ShipmentPendingFactCompletion",
);

export interface CompleteShipmentPendingFactsInput {
  tenantId: string;
  actorId: string;
  shipmentId: string;
  command: ShipmentPendingFactCompletionCommandV1;
  traceId: string;
}

export interface CompleteShipmentPendingFactsOutput {
  duplicate: boolean;
  relationshipVersion: number;
  traceId: string;
}

export interface ShipmentPendingFactCompletionPort {
  complete(
    input: CompleteShipmentPendingFactsInput,
  ): Promise<CompleteShipmentPendingFactsOutput>;
}

export class ShipmentPendingFactCompletionConflictError extends Error {}
export class ShipmentPendingFactCompletionNotFoundError extends Error {}
