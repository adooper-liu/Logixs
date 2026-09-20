import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { GET_PRODUCT_SKU } from "../../master-data";
import {
  ReplenishmentLineSkuBindingConflictError,
  type BindReplenishmentLineProductSkuCommand,
} from "../domain/replenishment-line-sku-binding";
import { REPLENISHMENT_LINE_SKU_BINDER } from "../domain/replenishment-line-sku-binding.repository";
import { BindReplenishmentLineProductSkuService } from "./bind-replenishment-line-product-sku.service";

const command: BindReplenishmentLineProductSkuCommand = {
  tenantId: "tenant-a",
  replenishmentOrderLineId: "11111111-1111-4111-8111-111111111111",
  productSkuId: "22222222-2222-4222-8222-222222222222",
  productNumber: "SKU-1",
  expectedVersion: 1,
};

async function buildService() {
  const getProductSku = {
    execute: vi.fn().mockResolvedValue({
      productSkuId: command.productSkuId,
      tenantId: command.tenantId,
      productNumber: command.productNumber,
      version: 1,
    }),
  };
  const binder = {
    bind: vi.fn().mockResolvedValue({
      replenishmentOrderLineId: command.replenishmentOrderLineId,
      productSkuId: command.productSkuId,
      productNumber: command.productNumber,
      version: 2,
      duplicate: false,
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      BindReplenishmentLineProductSkuService,
      { provide: GET_PRODUCT_SKU, useValue: getProductSku },
      { provide: REPLENISHMENT_LINE_SKU_BINDER, useValue: binder },
    ],
  }).compile();
  return {
    service: module.get(BindReplenishmentLineProductSkuService),
    getProductSku,
    binder,
  };
}

describe("BindReplenishmentLineProductSkuService", () => {
  it("先从公开 Port 核验 SKU，再绑定产品行", async () => {
    const { service, getProductSku, binder } = await buildService();

    await expect(service.execute(command)).resolves.toMatchObject({
      version: 2,
      duplicate: false,
    });
    expect(getProductSku.execute).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      productSkuId: command.productSkuId,
    });
    expect(binder.bind).toHaveBeenCalledTimes(1);
  });

  it("拒绝不存在或商品号不匹配的 SKU", async () => {
    const missing = await buildService();
    missing.getProductSku.execute.mockResolvedValueOnce(null);
    await expect(missing.service.execute(command)).rejects.toThrow(
      NotFoundException,
    );
    expect(missing.binder.bind).not.toHaveBeenCalled();

    const mismatch = await buildService();
    mismatch.getProductSku.execute.mockResolvedValueOnce({
      productSkuId: command.productSkuId,
      tenantId: command.tenantId,
      productNumber: "SKU-OTHER",
      version: 1,
    });
    await expect(mismatch.service.execute(command)).rejects.toThrow(
      ConflictException,
    );
    expect(mismatch.binder.bind).not.toHaveBeenCalled();
  });

  it("将仓储绑定冲突转换为稳定 409", async () => {
    const { service, binder } = await buildService();
    binder.bind.mockRejectedValueOnce(
      new ReplenishmentLineSkuBindingConflictError(
        "REPLENISHMENT_LINE_VERSION_CONFLICT",
      ),
    );

    await expect(service.execute(command)).rejects.toThrow(ConflictException);
  });
});
