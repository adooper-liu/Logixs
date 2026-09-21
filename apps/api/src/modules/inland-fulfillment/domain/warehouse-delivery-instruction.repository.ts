import type {
  NormalizedWarehouseDeliveryInstructionCommand,
  WarehouseDeliveryInstructionRecord,
} from "./warehouse-delivery-instruction";

export const WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY = Symbol(
  "WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY",
);

export interface WarehouseDeliveryInstructionRepository {
  findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<WarehouseDeliveryInstructionRecord | null>;
  replace(
    command: NormalizedWarehouseDeliveryInstructionCommand,
  ): Promise<WarehouseDeliveryInstructionRecord>;
}
