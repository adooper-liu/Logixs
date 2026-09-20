import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ContainerCargoAllocationConflictError,
  normalizeReplaceContainerCargoAllocationsCommand,
} from "../domain/container-cargo-allocation";
import { PrismaContainerCargoAllocationRepository } from "./prisma-container-cargo-allocation.repository";

const command = normalizeReplaceContainerCargoAllocationsCommand({
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  ingestionChannel: "file_import",
  sourceSystem: "legacy-lms",
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  idempotencyKey: "cargo:container-1:v1",
  allocations: [
    {
      replenishmentOrderLineId: "33333333-3333-4333-8333-333333333333",
      allocatedQuantity: "5",
      quantityUnit: "piece",
    },
  ],
});

function buildPrisma(options?: {
  existing?: {
    payloadHash: string;
  };
  productSkuId?: string | null;
  activeQuantity?: string;
}) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockAcquired: 1 }]),
    containerRecord: {
      findUnique: vi.fn().mockResolvedValue({ id: command.containerRecordId }),
    },
    replenishmentOrderLine: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: command.allocations[0]!.replenishmentOrderLineId,
          productSkuId:
            options && "productSkuId" in options
              ? options.productSkuId
              : "55555555-5555-4555-8555-555555555555",
          shippedQuantity: { toString: () => "10" },
          quantityUnit: "piece",
          isCurrent: true,
        },
      ]),
    },
    containerCargoAllocation: {
      findMany: vi.fn().mockResolvedValue(
        options?.activeQuantity
          ? [
              {
                replenishmentOrderLineId:
                  command.allocations[0]!.replenishmentOrderLineId,
                allocatedQuantity: {
                  toString: () => options.activeQuantity!,
                },
              },
            ]
          : [],
      ),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    containerCargoAllocationSet: {
      findUnique: vi.fn().mockResolvedValue(
        options?.existing
          ? {
              id: "66666666-6666-4666-8666-666666666666",
              containerRecordId: command.containerRecordId,
              version: 1,
              payloadHash: options.existing.payloadHash,
              _count: { allocations: 1 },
            }
          : null,
      ),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({
        id: "77777777-7777-4777-8777-777777777777",
        containerRecordId: command.containerRecordId,
        version: 1,
      }),
    },
  };
  return {
    transaction,
    prisma: {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    },
  };
}

async function buildRepository(prisma: object) {
  const module = await Test.createTestingModule({
    providers: [
      PrismaContainerCargoAllocationRepository,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(PrismaContainerCargoAllocationRepository);
}

describe("PrismaContainerCargoAllocationRepository", () => {
  it("锁定货柜与产品行后原子创建首个装载集合", async () => {
    const { prisma, transaction } = buildPrisma();
    const repository = await buildRepository(prisma);

    await expect(repository.replace(command)).resolves.toMatchObject({
      version: 1,
      allocationCount: 1,
      duplicate: false,
    });
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(3);
    expect(transaction.containerCargoAllocationSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-a",
          version: 1,
          state: "active",
        }),
      }),
    );
    expect(
      transaction.containerCargoAllocation.createMany,
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          allocationSetId: "77777777-7777-4777-8777-777777777777",
          replenishmentOrderLineId:
            command.allocations[0]!.replenishmentOrderLineId,
          allocatedQuantity: "5",
        }),
      ],
    });
  });

  it("同键同载荷重放返回原集合且不写入", async () => {
    const { prisma, transaction } = buildPrisma({
      existing: { payloadHash: command.payloadHash },
    });
    const repository = await buildRepository(prisma);

    await expect(repository.replace(command)).resolves.toMatchObject({
      duplicate: true,
      version: 1,
    });
    expect(transaction.containerRecord.findUnique).not.toHaveBeenCalled();
    expect(
      transaction.containerCargoAllocationSet.create,
    ).not.toHaveBeenCalled();
  });

  it("拒绝未绑定 SKU 和跨柜累计超分配", async () => {
    const unbound = buildPrisma({ productSkuId: null });
    const unboundRepository = await buildRepository(unbound.prisma);
    await expect(unboundRepository.replace(command)).rejects.toThrow(
      "REPLENISHMENT_ORDER_LINE_SKU_UNBOUND",
    );

    const over = buildPrisma({ activeQuantity: "6" });
    const overRepository = await buildRepository(over.prisma);
    await expect(overRepository.replace(command)).rejects.toThrow(
      ContainerCargoAllocationConflictError,
    );
  });
});
