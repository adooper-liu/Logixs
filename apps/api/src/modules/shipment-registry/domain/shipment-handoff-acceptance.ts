import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffCommandV2,
  ShipmentHandoffIssueV1,
  ShipmentHandoffPreflightResultV1,
  ShipmentHandoffResultV1,
} from "@logix/contracts";

type ShipmentHandoffCommand =
  ShipmentHandoffCommandV1 | ShipmentHandoffCommandV2;

export interface CommitShipmentHandoffCommand {
  actorId: string;
  command: ShipmentHandoffCommand;
  preflight: ShipmentHandoffPreflightResultV1;
}

export interface ShipmentHandoffAcceptanceRepository {
  commit(
    command: CommitShipmentHandoffCommand,
  ): Promise<ShipmentHandoffResultV1>;
}

export const SHIPMENT_HANDOFF_ACCEPTANCE_REPOSITORY = Symbol(
  "ShipmentHandoffAcceptanceRepository",
);

export class ShipmentHandoffAcceptanceConflictError extends Error {
  constructor(
    message: string,
    readonly issues: ShipmentHandoffIssueV1[] = [],
  ) {
    super(message);
  }
}
