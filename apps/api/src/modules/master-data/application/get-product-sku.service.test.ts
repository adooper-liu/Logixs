import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_SKU_REPOSITORY } from "../domain/product-sku.repository";
import { GetProductSkuService } from "./get-product-sku.service";

async function buildService() {
  const repository = {
    findById: vi.fn().mockResolvedValue({
      productSkuId: "11111111-1111-4111-8111-111111111111",
      tenantId: "tenant-a",
      productNumber: "SKU-1",
      version: 1,
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      GetProductSkuService,
      { provide: PRODUCT_SKU_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return { service: module.get(GetProductSkuService), repository };
}

describe("GetProductSkuService", () => {
  it("按租户和稳定 UUID 返回公共投影", async () => {
    const { service, repository } = await buildService();

    await expect(
      service.execute({
        tenantId: "tenant-a",
        productSkuId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toMatchObject({ productNumber: "SKU-1" });
    expect(repository.findById).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      productSkuId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("在仓储查询前拒绝非法 UUID", async () => {
    const { service, repository } = await buildService();

    await expect(
      service.execute({ tenantId: "tenant-a", productSkuId: "not-a-uuid" }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.findById).not.toHaveBeenCalled();
  });
});
