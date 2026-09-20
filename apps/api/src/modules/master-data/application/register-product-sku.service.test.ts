import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import {
  PRODUCT_SKU_REPOSITORY,
  ProductSkuIdempotencyConflictError,
} from "../domain/product-sku.repository";
import { RegisterProductSkuService } from "./register-product-sku.service";

async function buildService() {
  const repository = {
    register: vi.fn().mockResolvedValue({
      record: {
        productSkuId: "sku-id",
        tenantId: "tenant-a",
        productNumber: "SKU-1",
        version: 1,
      },
      duplicate: false,
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      RegisterProductSkuService,
      { provide: PRODUCT_SKU_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return { service: module.get(RegisterProductSkuService), repository };
}

const command = {
  tenantId: "tenant-a",
  productNumber: "SKU-1",
  idempotencyKey: "manual:sku-1",
};

describe("RegisterProductSkuService", () => {
  it("返回显式公共投影而不是数据库实体", async () => {
    const { service, repository } = await buildService();

    await expect(service.execute(command)).resolves.toEqual({
      productSkuId: "sku-id",
      productNumber: "SKU-1",
      version: 1,
      registrationState: "recorded",
    });
    expect(repository.register).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        productNumber: "SKU-1",
        payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("幂等重放返回 duplicate", async () => {
    const { service, repository } = await buildService();
    repository.register.mockResolvedValueOnce({
      record: {
        productSkuId: "sku-id",
        tenantId: "tenant-a",
        productNumber: "SKU-1",
        version: 1,
      },
      duplicate: true,
    });

    await expect(service.execute(command)).resolves.toMatchObject({
      productSkuId: "sku-id",
      registrationState: "duplicate",
    });
  });

  it("非法商品号在进入仓储前失败", async () => {
    const { service, repository } = await buildService();

    await expect(
      service.execute({ ...command, productNumber: " SKU-1" }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.register).not.toHaveBeenCalled();
  });

  it("同一幂等键异载荷返回稳定冲突", async () => {
    const { service, repository } = await buildService();
    repository.register.mockRejectedValueOnce(
      new ProductSkuIdempotencyConflictError(),
    );

    await expect(service.execute(command)).rejects.toThrow(ConflictException);
  });
});
