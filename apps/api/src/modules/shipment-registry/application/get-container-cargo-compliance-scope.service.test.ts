import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CONTAINER_CARGO_ALLOCATION_REPOSITORY } from "../domain/container-cargo-allocation.repository";
import { GetContainerCargoComplianceScopeService } from "./get-container-cargo-compliance-scope.service";

describe("GetContainerCargoComplianceScopeService", () => {
  it("delegates the tenant-scoped active snapshot query", async () => {
    const scope = {
      containerRecordId: "container-1",
      allocationSetId: "11111111-1111-4111-8111-111111111111",
      allocationSetVersion: 2,
      items: [],
    };
    const repository = {
      replace: vi.fn(),
      findActiveComplianceScope: vi.fn().mockResolvedValue(scope),
    };
    const module = await Test.createTestingModule({
      providers: [
        GetContainerCargoComplianceScopeService,
        {
          provide: CONTAINER_CARGO_ALLOCATION_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    await expect(
      module.get(GetContainerCargoComplianceScopeService).execute({
        tenantId: "tenant-1",
        containerRecordId: "container-1",
      }),
    ).resolves.toBe(scope);
    expect(repository.findActiveComplianceScope).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerRecordId: "container-1",
    });
  });
});
