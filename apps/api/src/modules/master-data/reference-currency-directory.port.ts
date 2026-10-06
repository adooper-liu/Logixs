export const REFERENCE_CURRENCY_DIRECTORY = Symbol.for(
  "logix.ReferenceCurrencyDirectory",
);

export interface ReferenceCurrencyRecord {
  alphaCode: string;
  numericCode: string;
  minorUnit: number | null;
  currencyName: string;
}

export type ReferenceCurrencyResolution =
  | { status: "active"; currency: ReferenceCurrencyRecord }
  | { status: "unknown"; currency: null }
  | { status: "unavailable"; currency: null };

export interface ReferenceCurrencyDirectoryPort {
  listActive(): Promise<ReferenceCurrencyRecord[]>;
  resolve(alphaCode: string): Promise<ReferenceCurrencyResolution>;
}
