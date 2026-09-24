import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  REFERENCE_PORT_REPOSITORY,
  type ReferencePortRepository,
} from "../domain/reference-port.repository";
import type {
  ReferencePortDirectoryPort,
  ReferencePortRecord,
  ReferencePortSearchResult,
} from "../reference-port-directory.port";

const UNLOCODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReferencePortDirectoryService implements ReferencePortDirectoryPort {
  constructor(
    @Inject(REFERENCE_PORT_REPOSITORY)
    private readonly repository: ReferencePortRepository,
  ) {}

  search(input: {
    query: string;
    pageSize: number;
    cursor?: string;
  }): Promise<ReferencePortSearchResult> {
    const normalizedQuery = normalizeQuery(input.query);
    if (!normalizedQuery || normalizedQuery.length > 100) {
      throw new BadRequestException("REFERENCE_PORT_QUERY_INVALID");
    }
    if (
      !Number.isInteger(input.pageSize) ||
      input.pageSize < 1 ||
      input.pageSize > 50
    ) {
      throw new BadRequestException("REFERENCE_PORT_PAGE_SIZE_INVALID");
    }
    const cursor = input.cursor?.trim().toUpperCase();
    if (cursor && !UNLOCODE_PATTERN.test(cursor)) {
      throw new BadRequestException("REFERENCE_PORT_CURSOR_INVALID");
    }
    return this.repository.searchActive({
      normalizedQuery,
      pageSize: input.pageSize,
      ...(cursor ? { cursor } : {}),
    });
  }

  findByUnlocodes(unlocodes: string[]): Promise<ReferencePortRecord[]> {
    const normalized = [
      ...new Set(unlocodes.map((code) => code.trim().toUpperCase())),
    ];
    if (
      normalized.length === 0 ||
      normalized.some((code) => !UNLOCODE_PATTERN.test(code))
    ) {
      throw new BadRequestException("REFERENCE_PORT_CODE_INVALID");
    }
    return this.repository.findActiveByUnlocodes(normalized);
  }

  findByIds(portIds: string[]): Promise<ReferencePortRecord[]> {
    const normalized = [...new Set(portIds.map((id) => id.trim()))];
    if (
      normalized.length === 0 ||
      normalized.some((id) => !UUID_PATTERN.test(id))
    ) {
      throw new BadRequestException("REFERENCE_PORT_ID_INVALID");
    }
    return this.repository.findByIds(normalized);
  }
}

function normalizeQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
