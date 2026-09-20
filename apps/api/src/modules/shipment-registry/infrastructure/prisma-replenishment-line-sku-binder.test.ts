import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReplenishmentLineSkuBindingConflictError } from "../domain/replenishment-line-sku-binding";
import { PrismaReplenishmentLineSkuBinder } from "./prisma-replenishment-line-sku-binder";

const command = {
  tenantId: "tenant-a",
  replenishmentOrderLineId: "11111111-1111-4111-8111-111111111111",
  productSkuId: "22222222-2222-4222-8222-222222222222",
  productNumber: "SKU-1",
  expectedVersion: 1,
};

function buildPrisma(productSkuId: string | null = null, version = 1) {
  const transaction = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ id: command.replenishmentOrderLineId }]),
    replenishmentOrderLine: {
      findUnique: vi.fn().mockResolvedValue({
        id: command.replenishmentOrderLineId,
        productSkuId,
        productNumber: "SKU-1",
        version,
      }),
      update: vi.fn().mockResolvedValue({
        id: command.replenishmentOrderLineId,
        productSkuId: command.productSkuId,
        productNumber: "SKU-1",
        version: 2,
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

async function buildBinder(prisma: object) {
  const module = await Test.createTestingModule({
    providers: [
      PrismaReplenishmentLineSkuBinder,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(PrismaReplenishmentLineSkuBinder);
}

describe("PrismaReplenishmentLineSkuBinder", () => {
  it("锁行后绑定 SKU 并递增版本", async () => {
    const { prisma, transaction } = buildPrisma();
    const binder = await buildBinder(prisma);

    await expect(binder.bind(command)).resolves.toMatchObject({
      productSkuId: command.productSkuId,
      version: 2,
      duplicate: false,
    });
    expect(transaction.replenishmentOrderLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          productSkuId: command.productSkuId,
          version: { increment: 1 },
        },
      }),
    );
  });

  it("相同绑定重放不写入，异值和旧版本拒绝", async () => {
    const replay = buildPrisma(command.productSkuId, 2);
    const replayBinder = await buildBinder(replay.prisma);
    await expect(replayBinder.bind(command)).resolves.toMatchObject({
      duplicate: true,
      version: 2,
    });
    expect(
      replay.transaction.replenishmentOrderLine.update,
    ).not.toHaveBeenCalled();

    const conflict = buildPrisma("33333333-3333-4333-8333-333333333333", 2);
    const conflictBinder = await buildBinder(conflict.prisma);
    await expect(conflictBinder.bind(command)).rejects.toThrow(
      ReplenishmentLineSkuBindingConflictError,
    );

    const stale = buildPrisma(null, 2);
    const staleBinder = await buildBinder(stale.prisma);
    await expect(staleBinder.bind(command)).rejects.toThrow(
      "REPLENISHMENT_LINE_VERSION_CONFLICT",
    );
  });
});
