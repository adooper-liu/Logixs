import type {
  ShipmentHandoffCommandV1,
  ShipmentHandoffPreflightResultV1,
  ShipmentHandoffResultV1,
} from "@logix/contracts";

export const PREFLIGHT_SHIPMENT_HANDOFF = Symbol("PreflightShipmentHandoff");
export const ACCEPT_SHIPMENT_HANDOFF = Symbol("AcceptShipmentHandoff");

export interface ShipmentHandoffRequestContext {
  tenantId: string;
  actorId: string;
}

export interface PreflightShipmentHandoffPort {
  preflight(
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<ShipmentHandoffPreflightResultV1>;
}

export interface AcceptShipmentHandoffPort {
  accept(
    input: unknown,
    context: ShipmentHandoffRequestContext,
  ): Promise<ShipmentHandoffResultV1>;
}

export type { ShipmentHandoffCommandV1 };
