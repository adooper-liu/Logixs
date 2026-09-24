import { describe, expect, it, vi } from "vitest";
import type { ReferencePortRepository } from "../domain/reference-port.repository";
import { ReferencePortDirectoryService } from "./reference-port-directory.service";

describe("ReferencePortDirectoryService", () => {
  it("normalizes a bounded search and delegates only to the active-release repository", async () => {
    const repository = {
      searchActive: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      findActiveByUnlocodes: vi.fn(),
      findByIds: vi.fn(),
    };
    const service = new ReferencePortDirectoryService(
      repository as ReferencePortRepository,
    );

    await service.search({ query: "  福州  ", pageSize: 20 });

    expect(repository.searchActive).toHaveBeenCalledWith({
      normalizedQuery: "福州",
      pageSize: 20,
    });
  });

  it.each([
    [{ query: "", pageSize: 20 }, "REFERENCE_PORT_QUERY_INVALID"],
    [{ query: "Fuzhou", pageSize: 0 }, "REFERENCE_PORT_PAGE_SIZE_INVALID"],
    [
      { query: "Fuzhou", pageSize: 20, cursor: "bad" },
      "REFERENCE_PORT_CURSOR_INVALID",
    ],
  ])("rejects an invalid search boundary", async (input, code) => {
    const service = new ReferencePortDirectoryService({
      searchActive: vi.fn(),
      findActiveByUnlocodes: vi.fn(),
      findByIds: vi.fn(),
    });

    expect(() => service.search(input)).toThrow(code);
  });

  it("normalizes and deduplicates UN/LOCODE validation", async () => {
    const repository = {
      searchActive: vi.fn(),
      findActiveByUnlocodes: vi.fn().mockResolvedValue([]),
      findByIds: vi.fn(),
    };
    const service = new ReferencePortDirectoryService(
      repository as ReferencePortRepository,
    );

    await service.findByUnlocodes([" cnfzg ", "CNFZG", "ussav"]);

    expect(repository.findActiveByUnlocodes).toHaveBeenCalledWith([
      "CNFZG",
      "USSAV",
    ]);
  });
});
