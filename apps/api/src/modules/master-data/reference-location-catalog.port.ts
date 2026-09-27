export const REFERENCE_LOCATION_CATALOG = Symbol(
  "logix.ReferenceLocationCatalog",
);

export interface ReferenceCountryOption {
  code: string;
  name: string;
  nameChinese: string;
}

export interface ReferencePortOption {
  code: string;
  name: string;
  nameChinese: string | null;
  nameChineseState: "confirmed" | "candidate" | "missing";
  countryCode: string;
  countryNameChinese: string;
}

export interface ReferenceLocationCatalogSnapshot {
  countryReleaseVersion: string;
  portReleaseVersion: string;
  countries: ReferenceCountryOption[];
  ports: ReferencePortOption[];
}

export interface ReferenceLocationCatalogPort {
  listActive(): Promise<ReferenceLocationCatalogSnapshot>;
}
