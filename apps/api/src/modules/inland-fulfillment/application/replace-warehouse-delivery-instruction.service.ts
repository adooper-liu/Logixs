import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WarehouseDeliveryInstructionConflictError,
  WarehouseDeliveryInstructionNotFoundError,
  WarehouseDeliveryInstructionValidationError,
  normalizeWarehouseDeliveryInstructionCommand,
  type ReplaceWarehouseDeliveryInstructionCommand,
  type WarehouseDeliveryInstructionRecord,
} from "../domain/warehouse-delivery-instruction";
import {
  WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY,
  type WarehouseDeliveryInstructionRepository,
} from "../domain/warehouse-delivery-instruction.repository";
import type { ReplaceWarehouseDeliveryInstructionPort } from "../replace-warehouse-delivery-instruction.port";

@Injectable()
export class ReplaceWarehouseDeliveryInstructionService implements ReplaceWarehouseDeliveryInstructionPort {
  constructor(
    @Inject(WAREHOUSE_DELIVERY_INSTRUCTION_REPOSITORY)
    private readonly repository: WarehouseDeliveryInstructionRepository,
  ) {}

  async execute(
    command: ReplaceWarehouseDeliveryInstructionCommand,
  ): Promise<WarehouseDeliveryInstructionRecord> {
    let normalized;
    try {
      normalized = normalizeWarehouseDeliveryInstructionCommand(command);
    } catch (error) {
      if (error instanceof WarehouseDeliveryInstructionValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    try {
      return await this.repository.replace(normalized);
    } catch (error) {
      if (error instanceof WarehouseDeliveryInstructionNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof WarehouseDeliveryInstructionConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
