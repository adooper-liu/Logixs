import { Inject, Injectable } from "@nestjs/common";
import type { WarehouseDeliveryInstructionRecord } from "../domain/warehouse-delivery-instruction";
import {
  WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY,
  type WarehouseDeliveryInstructionRepository,
} from "../domain/warehouse-delivery-instruction.repository";

@Injectable()
export class GetWarehouseDeliveryInstructionService {
  constructor(
    @Inject(WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY)
    private readonly repository: WarehouseDeliveryInstructionRepository,
  ) {}

  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<WarehouseDeliveryInstructionRecord | null> {
    return this.repository.findCurrent(input);
  }
}
