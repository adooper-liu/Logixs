import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import { PrismaProductSkuRepository } from "./prisma-product-sku.repository";

const input = {
  tenantId: "tenant-a",
  productNumber: "SKU-1",
  idempotencyKey: "import:batch-1:row-1",
  payloadHash: "a".repeat(64),
};

function buildPrisma(
  existingRegistration: null | {
    payloadHash: string;
    productSku: {
      id: string;
      tenantId: string;
      productNumber: string;
      version: number;
    };
  } = null,
) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    productSkuRegistration: {
      findUnique: vi.fn().mockResolvedValue(existingRegistration),
      create: vi.fn().mockResolvedValue({ id: "registration-id" }),
    },
    productSku: {
      upsert: vi.fn().mockResolvedValue({
        id: "sku-id",
        tenantId: "tenant-a",
        productNumber: "SKU-1",
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
      PrismaProductSkuRepository,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(PrismaProductSkuRepository);
}

describe("PrismaProductSkuRepository", () => {
  it("在一个事务中解析 SKU 并登记幂等结果", async () => {
    const { prisma, transaction } = buildPrisma();
    const repository = await buildRepository(prisma);

    await expect(repository.register(input)).resolves.toEqual({
      record: {
        productSkuId: "sku-id",
        tenantId: "tenant-a",
        productNumber: "SKU-1",
        version: 1,
      },
      duplicate: false,
    });
    expect(transaction.productSku.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_productNumber: {
            tenantId: "tenant-a",
            productNumber: "SKU-1",
          },
        },
      }),
    );
    expect(transaction.productSkuRegistration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        idempotencyKey: "import:batch-1:row-1",
        productSkuId: "sku-id",
      }),
    });
  });

  it("同载荷重放返回原 SKU 且不再次写入", async () => {
    const { prisma, transaction } = buildPrisma({
      payloadHash: input.payloadHash,
      productSku: {
        id: "existing-sku",
        tenantId: "tenant-a",
        productNumber: "SKU-1",
        version: 1,
      },
    });
    const repository = await buildRepository(prisma);

    await expect(repository.register(input)).resolves.toMatchObject({
      record: { productSkuId: "existing-sku" },
      duplicate: true,
    });
    expect(transaction.productSku.upsert).not.toHaveBeenCalled();
    expect(transaction.productSkuRegistration.create).not.toHaveBeenCalled();
  });

  it("同键异载荷拒绝且不触碰 SKU", async () => {
    const { prisma, transaction } = buildPrisma({
      payloadHash: "b".repeat(64),
      productSku: {
        id: "existing-sku",
        tenantId: "tenant-a",
        productNumber: "SKU-OTHER",
        version: 1,
      },
    });
    const repository = await buildRepository(prisma);

    await expect(repository.register(input)).rejects.toThrow(
      "MASTER_DATA_IDEMPOTENCY_CONFLICT",
    );
    expect(transaction.productSku.upsert).not.toHaveBeenCalled();
  });
});
