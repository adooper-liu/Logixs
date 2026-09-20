import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_COMPLIANCE_PROFILE_REPOSITORY } from "../domain/product-compliance-profile.repository";
import { GetProductComplianceProfileService } from "./get-product-compliance-profile.service";

async function buildService() {
  const repository = { findCurrent: vi.fn().mockResolvedValue(null) };
  const module = await Test.createTestingModule({
    providers: [
      GetProductComplianceProfileService,
      { provide: PRODUCT_COMPLIANCE_PROFILE_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return {
    service: module.get(GetProductComplianceProfileService),
    repository,
  };
}

describe("GetProductComplianceProfileService", () => {
  it("按租户与 SKU 读取当前档案", async () => {
    const { service, repository } = await buildService();
    const query = {
      tenantId: "tenant-a",
      productSkuId: "11111111-1111-4111-8111-111111111111",
    };

    await expect(service.execute(query)).resolves.toBeNull();
    expect(repository.findCurrent).toHaveBeenCalledWith(query);
  });

  it("非法 UUID 不进入仓储", async () => {
    const { service, repository } = await buildService();

    await expect(
      service.execute({ tenantId: "tenant-a", productSkuId: "not-a-uuid" }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.findCurrent).not.toHaveBeenCalled();
  });
});
