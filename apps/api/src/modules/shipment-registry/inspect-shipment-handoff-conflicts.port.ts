import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffIssueV1,
} from "@logix/contracts";

export const INSPECT_SHIPMENT_HANDOFF_CONFLICTS = Symbol(
  "InspectShipmentHandoffConflicts",
);

export interface ShipmentHandoffConflictInspection {
  duplicate: boolean;
  issues: ShipmentHandoffIssueV1[];
}

export interface InspectShipmentHandoffConflictsPort {
  inspect(
    command: ShipmentHandoffCommandV1,
    payloadHash: string,
  ): Promise<ShipmentHandoffConflictInspection>;
}
