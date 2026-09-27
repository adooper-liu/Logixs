import type { CargoOwnerDirectoryRecord } from "../cargo-owner-directory.port";

export const CARGO_OWNER_REPOSITORY = Symbol("CargoOwnerRepository");

export interface CargoOwnerRepository {
  listActive(): Promise<CargoOwnerDirectoryRecord[]>;
  findActiveById(id: string): Promise<CargoOwnerDirectoryRecord | null>;
}
