export const REFERENCE_PORT_DIRECTORY = Symbol.for(
  "logix.ReferencePortDirectory",
);

export interface ReferencePortRecord {
  portId: string;
  unlocode: string;
  officialName: string;
  areaCode: string;
}

export interface ReferencePortSearchResult {
  items: ReferencePortRecord[];
  nextCursor: string | null;
}

export interface ReferencePortDirectoryPort {
  search(input: {
    query: string;
    pageSize: number;
    cursor?: string;
  }): Promise<ReferencePortSearchResult>;
  findByUnlocodes(unlocodes: string[]): Promise<ReferencePortRecord[]>;
  findByIds(portIds: string[]): Promise<ReferencePortRecord[]>;
}
