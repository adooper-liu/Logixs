import { Inject, Injectable } from "@nestjs/common";
import type {
  CargoOwnerDirectoryPort,
  CargoOwnerDirectoryRecord,
} from "../cargo-owner-directory.port";
import {
  CARGO_OWNER_REPOSITORY,
  type CargoOwnerRepository,
} from "../domain/cargo-owner.repository";

@Injectable()
export class CargoOwnerDirectoryService implements CargoOwnerDirectoryPort {
  constructor(
    @Inject(CARGO_OWNER_REPOSITORY)
    private readonly repository: CargoOwnerRepository,
  ) {}

  listActive(): Promise<CargoOwnerDirectoryRecord[]> {
    return this.repository.listActive();
  }

  findActiveById(id: string): Promise<CargoOwnerDirectoryRecord | null> {
    return this.repository.findActiveById(id);
  }
}
