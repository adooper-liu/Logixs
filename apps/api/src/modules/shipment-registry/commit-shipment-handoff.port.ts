import type { ShipmentHandoffResultV1 } from "@logix/contracts";
import type { CommitShipmentHandoffCommand } from "./domain/shipment-handoff-acceptance";

export const COMMIT_SHIPMENT_HANDOFF = Symbol("CommitShipmentHandoff");

export interface CommitShipmentHandoffPort {
  execute(
    command: CommitShipmentHandoffCommand,
  ): Promise<ShipmentHandoffResultV1>;
}

export type { CommitShipmentHandoffCommand };
