import type {
  ReferencePortRecord,
  ReferencePortSearchResult,
} from "../reference-port-directory.port";

export const REFERENCE_PORT_REPOSITORY = Symbol("ReferencePortRepository");

export interface ReferencePortRepository {
  searchActive(input: {
    normalizedQuery: string;
    pageSize: number;
    cursor?: string;
  }): Promise<ReferencePortSearchResult>;
  findActiveByUnlocodes(unlocodes: string[]): Promise<ReferencePortRecord[]>;
  findByIds(portIds: string[]): Promise<ReferencePortRecord[]>;
}
