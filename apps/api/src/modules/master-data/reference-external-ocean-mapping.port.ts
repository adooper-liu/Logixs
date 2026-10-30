import type { ReferenceDataset } from "./domain/provider-profile";

export const REFERENCE_EXTERNAL_OCEAN_MAPPING = Symbol(
  "REFERENCE_EXTERNAL_OCEAN_MAPPING",
);
export interface MappingQuery {
  provider: string;
  profileVersion: string;
  dataset: ReferenceDataset;
  namespace: string;
  sourceCode: string;
}
export type MappingResolution =
  | {
      status: "resolved";
      canonicalCode: string;
      canonicalReleaseId: string;
      via: "standard" | "mapping";
    }
  | {
      status:
        | "pending_review"
        | "unknown"
        | "unavailable"
        | "unsupported_namespace"
        | "rejected";
    };
export interface ExternalOceanMappingDirectoryPort {
  inspectProfile(
    provider: string,
    profileVersion: string,
  ): Promise<{
    profiles: Array<{
      provider: string;
      profileVersion: string;
      datasetCode: string;
      status: string;
    }>;
    mappings: Array<{
      provider: string;
      profileVersion: string;
      datasetCode: string;
      sourceNamespace: string;
      sourceCode: string;
      canonicalCode: string | null;
      mappingState: string;
    }>;
  }>;
  resolve(query: MappingQuery): Promise<MappingResolution>;
}
