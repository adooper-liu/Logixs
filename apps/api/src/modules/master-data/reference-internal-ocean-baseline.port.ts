export const REFERENCE_INTERNAL_OCEAN_BASELINE = Symbol(
  "REFERENCE_INTERNAL_OceanBaseline",
);

export interface InternalOceanCarrierRecord {
  canonicalCode: string;
  nameZh: string | null;
  nameEn: string;
  standardCode?: string | null;
  standardVersion?: string | null;
  sourceUrl?: string | null;
  isVocc?: boolean | null;
  isNvocc?: boolean | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  status: string;
}

export interface InternalContainerTypeRecord {
  canonicalCode: string;
  length: number;
  typeCode: string;
  standardBasis?: unknown;
  status: string;
}

export interface InternalOceanBaseline {
  release: { id: string; version: string };
  carriers: InternalOceanCarrierRecord[];
  containerTypes: InternalContainerTypeRecord[];
}

export interface ReferenceInternalOceanBaselinePort {
  readBaseline(): Promise<InternalOceanBaseline>;
}
