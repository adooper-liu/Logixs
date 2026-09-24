import type { InternalShipmentHandoffCandidateV1 } from "@logix/contracts";

export const INTERNAL_SHIPMENT_HANDOFF_SOURCE = Symbol(
  "InternalShipmentHandoffSource",
);

export interface InternalShipmentHandoffSourcePort {
  listCandidates(input: {
    tenantId: string;
  }): Promise<InternalShipmentHandoffCandidateV1[]>;
  findCandidate(input: {
    tenantId: string;
    candidateRef: string;
  }): Promise<InternalShipmentHandoffCandidateV1 | null>;
}
