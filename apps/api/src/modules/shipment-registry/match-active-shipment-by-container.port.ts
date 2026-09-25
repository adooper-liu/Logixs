export const MATCH_ACTIVE_SHIPMENT_BY_CONTAINER = Symbol.for(
  "logix.MatchActiveShipmentByContainer",
);

export type ActiveShipmentContainerMatch =
  | {
      containerNumber: string;
      state: "matched";
      shipmentId: string;
      shipmentNumber: string | null;
      relationshipVersion: number;
    }
  | { containerNumber: string; state: "not_found" }
  | { containerNumber: string; state: "conflict" };

export interface MatchActiveShipmentByContainerPort {
  matchByContainerNumbers(
    tenantId: string,
    containerNumbers: readonly string[],
    context?: {
      excludeSourceSystem: string;
      excludeExternalHandoffPrefix: string;
    },
  ): Promise<ActiveShipmentContainerMatch[]>;
}
