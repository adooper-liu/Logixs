import { describe, expect, it, vi } from "vitest";
import type { ReferencePortDirectoryPort } from "../../master-data";
import { SearchPostDepartureReferencePortsService } from "./search-post-departure-reference-ports.service";

describe("SearchPostDepartureReferencePortsService", () => {
  it("searches the authoritative directory and preserves pagination", async () => {
    const ports = {
      search: vi.fn().mockResolvedValue({
        items: [
          {
            portId: "11111111-1111-4111-8111-111111111111",
            unlocode: "CNFZG",
            officialName: "Fuzhou Pt",
            areaCode: "CN",
          },
        ],
        nextCursor: "CNFZG",
      }),
    } as unknown as ReferencePortDirectoryPort;
    const service = new SearchPostDepartureReferencePortsService(ports);

    await expect(
      service.execute({ query: "福州", pageSize: 20, cursor: "CNFOC" }),
    ).resolves.toEqual({
      items: [
        {
          portId: "11111111-1111-4111-8111-111111111111",
          unlocode: "CNFZG",
          officialName: "Fuzhou Pt",
          areaCode: "CN",
        },
      ],
      pageSize: 20,
      nextCursor: "CNFZG",
    });
    expect(ports.search).toHaveBeenCalledWith({
      query: "福州",
      pageSize: 20,
      cursor: "CNFOC",
    });
  });
});
