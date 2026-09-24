import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffIssueV1,
  ShipmentHandoffPreflightResultV1,
  ShipmentHandoffResultV1,
} from "@logix/contracts";

export interface CommitShipmentHandoffCommand {
  actorId: string;
  command: ShipmentHandoffCommandV1;
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
