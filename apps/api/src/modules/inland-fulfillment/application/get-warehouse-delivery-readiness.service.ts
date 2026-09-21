import { Inject, Injectable } from "@nestjs/common";
import type {
  GetWarehouseDeliveryReadinessPort,
  WarehouseDeliveryReadinessResult,
} from "../get-warehouse-delivery-readiness.port";
import {
  WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY,
  type WarehouseDeliveryInstructionRepository,
} from "../domain/warehouse-delivery-instruction.repository";

@Injectable()
export class GetWarehouseDeliveryReadinessService implements GetWarehouseDeliveryReadinessPort {
  constructor(
    @Inject(WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY)
    private readonly repository: WarehouseDeliveryInstructionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<WarehouseDeliveryReadinessResult> {
    const instruction = await this.repository.findCurrent(input);
    return instruction
      ? { confirmed: true, reasonCode: null, instruction }
      : {
          confirmed: false,
          reasonCode: "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION",
          instruction: null,
        };
  }
}
