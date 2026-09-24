import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffCommandV2,
  ShipmentHandoffIssueV1,
} from "@logix/contracts";

type ShipmentHandoffCommand =
  ShipmentHandoffCommandV1 | ShipmentHandoffCommandV2;

export const INSPECT_SHIPMENT_HANDOFF_CONFLICTS = Symbol(
  "InspectShipmentHandoffConflicts",
);

export interface ShipmentHandoffConflictInspection {
  duplicate: boolean;
  issues: ShipmentHandoffIssueV1[];
}

export interface InspectShipmentHandoffConflictsPort {
  inspect(
    command: ShipmentHandoffCommand,
    payloadHash: string,
  ): Promise<ShipmentHandoffConflictInspection>;
}
