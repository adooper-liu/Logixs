import type {
  ReplaceWarehouseDeliveryInstructionCommand,
  WarehouseDeliveryInstructionRecord,
} from "./domain/warehouse-delivery-instruction";

export const REPLACE_WAREHOUSE_DELIVERY_INSTRUCTION = Symbol.for(
  "logix.ReplaceWarehouseDeliveryInstruction",
);

export interface ReplaceWarehouseDeliveryInstructionPort {
  execute(
    command: ReplaceWarehouseDeliveryInstructionCommand,
  ): Promise<WarehouseDeliveryInstructionRecord>;
}
