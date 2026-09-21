import type { WarehouseDeliveryInstructionRecord } from "./domain/warehouse-delivery-instruction";

export const GET_WAREHOUSE_DELIVERY_READINESS = Symbol.for(
  "logix.GetWarehouseDeliveryReadiness",
);

export interface WarehouseDeliveryReadinessResult {
  confirmed: boolean;
  reasonCode: "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION" | null;
  instruction: WarehouseDeliveryInstructionRecord | null;
}

export interface GetWarehouseDeliveryReadinessPort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<WarehouseDeliveryReadinessResult>;
}
