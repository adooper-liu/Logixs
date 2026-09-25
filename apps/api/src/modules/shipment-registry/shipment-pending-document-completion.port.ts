import type { ShipmentPendingDocumentCompletionCommandV1 } from "@logix/contracts";

export const SHIPMENT_PENDING_DOCUMENT_COMPLETION = Symbol(
  "ShipmentPendingDocumentCompletion",
);

export interface CompleteShipmentPendingDocumentsInput {
  tenantId: string;
  actorId: string;
  shipmentId: string;
  command: ShipmentPendingDocumentCompletionCommandV1;
  traceId: string;
}

export interface CompleteShipmentPendingDocumentsOutput {
  duplicate: boolean;
  relationshipVersion: number;
  documentCount: number;
  traceId: string;
}

export interface ShipmentPendingDocumentCompletionPort {
  complete(
    input: CompleteShipmentPendingDocumentsInput,
  ): Promise<CompleteShipmentPendingDocumentsOutput>;
}

export class ShipmentPendingDocumentCompletionConflictError extends Error {}
export class ShipmentPendingDocumentCompletionNotFoundError extends Error {}
