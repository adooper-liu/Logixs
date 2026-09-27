import { Inject, Injectable } from "@nestjs/common";
import type { ShipmentIntakeReferenceDataV1 } from "@logix/contracts";
import {
  CARGO_OWNER_DIRECTORY,
  type CargoOwnerDirectoryPort,
} from "../../master-data";

@Injectable()
export class ListShipmentIntakeReferenceDataService {
  constructor(
    @Inject(CARGO_OWNER_DIRECTORY)
    private readonly cargoOwners: CargoOwnerDirectoryPort,
  ) {}

  async execute(): Promise<ShipmentIntakeReferenceDataV1> {
    return {
      contractVersion: "shipment-intake-reference-data.v1",
      cargoOwners: await this.cargoOwners.listActive(),
    };
  }
}
