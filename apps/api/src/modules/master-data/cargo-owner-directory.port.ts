export const CARGO_OWNER_DIRECTORY = Symbol.for("logix.CargoOwnerDirectory");

export interface CargoOwnerDirectoryRecord {
  id: string;
  stableCode: string;
  legalName: string;
  salesCountryCode: string;
  salesCountryNameChinese: string;
}

export interface CargoOwnerDirectoryPort {
  listActive(): Promise<CargoOwnerDirectoryRecord[]>;
  findActiveById(id: string): Promise<CargoOwnerDirectoryRecord | null>;
}
