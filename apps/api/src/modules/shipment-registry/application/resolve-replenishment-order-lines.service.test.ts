import { describe, expect, it, vi } from "vitest";
import { ResolveReplenishmentOrderLinesService } from "./resolve-replenishment-order-lines.service";

describe("ResolveReplenishmentOrderLinesService", () => {
  it("deduplicates business identities and preserves tenant scope", async () => {
    const repository = {
      resolveCurrentLines: vi.fn().mockResolvedValue([]),
    };
    const service = new ResolveReplenishmentOrderLinesService(
      repository as never,
    );

    await service.execute({
      tenantId: "tenant-a",
      identities: [
        {
          replenishmentOrderNumber: "26DSA01884",
          productNumber: "SKU-001",
        },
        {
          replenishmentOrderNumber: "26DSA01884",
          productNumber: "SKU-001",
        },
      ],
    });

    expect(repository.resolveCurrentLines).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      identities: [
        {
          replenishmentOrderNumber: "26DSA01884",
          productNumber: "SKU-001",
        },
      ],
    });
  });
});
