import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ResolveProductSkusService } from "./resolve-product-skus.service";

describe("ResolveProductSkusService", () => {
  it("deduplicates product numbers and preserves tenant scope", async () => {
    const repository = {
      findByProductNumbers: vi.fn().mockResolvedValue([
        {
          productSkuId: "11111111-1111-4111-8111-111111111111",
          tenantId: "tenant-a",
          productNumber: "SKU-1",
          version: 1,
        },
      ]),
    };
    const service = new ResolveProductSkusService(repository as never);

    await expect(
      service.execute({
        tenantId: "tenant-a",
        productNumbers: ["SKU-1", "SKU-1"],
      }),
    ).resolves.toEqual([
      {
        productSkuId: "11111111-1111-4111-8111-111111111111",
        productNumber: "SKU-1",
        version: 1,
      },
    ]);
    expect(repository.findByProductNumbers).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      productNumbers: ["SKU-1"],
    });
  });

  it("rejects blank product numbers", async () => {
    const service = new ResolveProductSkusService({} as never);
    await expect(
      service.execute({ tenantId: "tenant-a", productNumbers: [" "] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
