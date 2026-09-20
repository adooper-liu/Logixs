import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import {
  ContainerCargoAllocationConflictError,
  ContainerCargoAllocationNotFoundError,
} from "../domain/container-cargo-allocation";
import { CONTAINER_CARGO_ALLOCATION_REPOSITORY } from "../domain/container-cargo-allocation.repository";
import { ReplaceContainerCargoAllocationsService } from "./replace-container-cargo-allocations.service";

const command = {
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  ingestionChannel: "manual_ui" as const,
  sourceSystem: "logix-web",
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "cargo:container-1:v1",
  allocations: [
    {
      replenishmentOrderLineId: "33333333-3333-4333-8333-333333333333",
      allocatedQuantity: "10",
      quantityUnit: "piece" as const,
    },
  ],
};

async function buildService() {
  const repository = {
    replace: vi.fn().mockResolvedValue({
      allocationSetId: "44444444-4444-4444-8444-444444444444",
      containerRecordId: command.containerRecordId,
      version: 1,
      allocationCount: 1,
      duplicate: false,
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      ReplaceContainerCargoAllocationsService,
      {
        provide: CONTAINER_CARGO_ALLOCATION_REPOSITORY,
        useValue: repository,
      },
    ],
  }).compile();
  return {
    service: module.get(ReplaceContainerCargoAllocationsService),
    repository,
  };
}

describe("ReplaceContainerCargoAllocationsService", () => {
  it("规范命令后调用原子写仓储", async () => {
    const { service, repository } = await buildService();

    await expect(service.execute(command)).resolves.toMatchObject({
      version: 1,
    });
    expect(repository.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("映射校验、缺失和冲突错误", async () => {
    const invalid = await buildService();
    await expect(
      invalid.service.execute({ ...command, evidenceRefs: [] }),
    ).rejects.toThrow(BadRequestException);

    const missing = await buildService();
    missing.repository.replace.mockRejectedValueOnce(
      new ContainerCargoAllocationNotFoundError("CONTAINER_RECORD_NOT_FOUND"),
    );
    await expect(missing.service.execute(command)).rejects.toThrow(
      NotFoundException,
    );

    const conflict = await buildService();
    conflict.repository.replace.mockRejectedValueOnce(
      new ContainerCargoAllocationConflictError(
        "CARGO_ALLOCATION_VERSION_CONFLICT",
      ),
    );
    await expect(conflict.service.execute(command)).rejects.toThrow(
      ConflictException,
    );
  });
});
