import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { ShipmentHandoffResultV1 } from "@logix/contracts";
import type { CommitShipmentHandoffPort } from "../commit-shipment-handoff.port";
import {
  SHIPMENT_HANDOFF_ACCEPTANCE_REPOSITORY,
  ShipmentHandoffAcceptanceConflictError,
  type CommitShipmentHandoffCommand,
  type ShipmentHandoffAcceptanceRepository,
} from "../domain/shipment-handoff-acceptance";

@Injectable()
export class CommitShipmentHandoffService implements CommitShipmentHandoffPort {
  constructor(
    @Inject(SHIPMENT_HANDOFF_ACCEPTANCE_REPOSITORY)
    private readonly repository: ShipmentHandoffAcceptanceRepository,
  ) {}

  async execute(
    command: CommitShipmentHandoffCommand,
  ): Promise<ShipmentHandoffResultV1> {
    try {
      return await this.repository.commit(command);
    } catch (error) {
      if (error instanceof ShipmentHandoffAcceptanceConflictError) {
        throw new ConflictException({
          code: error.message,
          issues: error.issues,
        });
      }
      throw error;
    }
  }
}
