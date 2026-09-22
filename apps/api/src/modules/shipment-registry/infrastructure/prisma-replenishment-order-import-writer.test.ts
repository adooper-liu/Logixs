import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import { PrismaReplenishmentOrderImportWriter } from "./prisma-replenishment-order-import-writer";

function buildPrisma(options?: {
  containers?: Array<{
    id: string;
    containerNumber: string | null;
    replenishmentOrderId?: string | null;
  }>;
  sameNumberContainers?: Array<{
    id: string;
    containerNumber: string | null;
    replenishmentOrderId?: string | null;
  }>;
  binding?: {
    containerRecord: {
      id: string;
      containerNumber: string | null;
      replenishmentOrderId: string | null;
    };
  } | null;
  currentFacts?: Array<Record<string, unknown>>;
  failLines?: boolean;
}) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "o1" }]),
    replenishmentOrder: {
      upsert: vi.fn().mockResolvedValue({ id: "o1" }),
    },
    containerRecord: {
      findMany: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            where.orderNumber
              ? (options?.containers ?? [])
              : (options?.sameNumberContainers ?? []),
          ),
        ),
      update: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: options?.binding?.containerRecord.id ?? "c-existing",
          replenishmentOrderId:
            options?.binding?.containerRecord.replenishmentOrderId ??
            data.replenishmentOrderId ??
            null,
        }),
      ),
      create: vi.fn().mockResolvedValue({
        id: "c-new",
        replenishmentOrderId: "o1",
      }),
    },
    containerImportBinding: {
      findUnique: vi.fn().mockResolvedValue(options?.binding ?? null),
      create: vi.fn().mockResolvedValue({ id: "binding-1" }),
    },
    replenishmentOrderLine: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: options?.failLines
        ? vi.fn().mockRejectedValue(new Error("line write failed"))
        : vi.fn().mockResolvedValue({ count: 2 }),
    },
    shipmentTimeFact: {
      findMany: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(where.isCurrent ? (options?.currentFacts ?? []) : []),
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    inboxMessage: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
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

async function buildWriter(prisma: object) {
  const module = await Test.createTestingModule({
    providers: [
      PrismaReplenishmentOrderImportWriter,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(PrismaReplenishmentOrderImportWriter);
}

const command = {
  tenantId: "tenant-a",
  sourceBatchId: "batch1",
  orderNumber: "SO-1",
  containerNumber: "MSKU1",
  lines: [
    {
      sourceRowId: "r1",
      productNumber: "SKU-1",
      shippedQuantity: "10",
      quantityUnit: "piece" as const,
      contractNumber: null,
    },
    {
      sourceRowId: "r2",
      productNumber: "SKU-2",
      shippedQuantity: "20",
      quantityUnit: "piece" as const,
      contractNumber: "C-2",
    },
  ],
  timeFacts: [],
};

describe("PrismaReplenishmentOrderImportWriter", () => {
  it("在一个事务中写备货单、货柜、批次解析绑定和全部产品行", async () => {
    const { prisma, transaction } = buildPrisma();
    const writer = await buildWriter(prisma);

    const result = await writer.apply(command);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.containerRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a", orderNumber: "SO-1" },
      }),
    );
    expect(transaction.containerImportBinding.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        sourceBatchId: "batch1",
        containerNumber: "MSKU1",
        containerRecordId: "c-new",
      },
    });
    expect(transaction.replenishmentOrderLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            tenantId: "tenant-a",
            sourceRowId: "r1",
          }),
        ]),
      }),
    );
    expect(result.containerRecordId).toBe("c-new");
  });

  it("产品行写入失败时事务调用整体拒绝", async () => {
    const { prisma } = buildPrisma({ failLines: true });
    const writer = await buildWriter(prisma);

    await expect(writer.apply(command)).rejects.toThrow("line write failed");
  });

  it("把 actual 时间事实与产品明细写在同一事务且保留来源字段", async () => {
    const { prisma, transaction } = buildPrisma();
    const writer = await buildWriter(prisma);

    await writer.apply({
      ...command,
      timeFacts: [
        {
          sourceRowId: "r1",
          factCode: "customs_clearance_completed",
          timeKind: "actual",
          captureSource: "controlled_import",
          eventCode: "container_customs_completed",
          rawValue: "2026-04-09 22:58:00",
          occurredAtUtc: new Date("2026-04-09T20:58:00Z"),
          sourceUtcOffset: "+02:00",
          sourceSystem: "legacy-lms",
          authoritySystem: "customs-authority",
          sourceStatus: "已完成",
          evidenceRef: "11111111-1111-4111-8111-111111111111",
          derivationRuleVersion: null,
          nodeCode: "customs_clearance",
          mappingVersion: "1.3.0",
        },
      ],
    });

    expect(transaction.shipmentTimeFact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          containerRecordId: "c-new",
          factCode: { in: ["customs_clearance_completed"] },
        }),
      }),
    );
    expect(transaction.shipmentTimeFact.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          containerRecordId: "c-new",
          timeKind: "actual",
          rawValue: "2026-04-09 22:58:00",
          sourceUtcOffset: "+02:00",
        }),
      ],
    });
    expect(transaction.inboxMessage.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          consumerName: "lifecycle-control-inbox",
          state: "received",
          payloadJson: expect.objectContaining({
            kind: "lifecycle_date_fact.record_requested.v1",
            command: expect.objectContaining({
              containerId: "c-new",
              nodeCode: "customs_clearance",
              ingestionChannel: "file_import",
              verificationState: "pending",
              confidenceState: "unknown",
            }),
          }),
        }),
      ],
    });
  });

  it("同租户同备货单匹配多个历史货柜时拒绝猜测", async () => {
    const { prisma } = buildPrisma({
      containers: [
        { id: "c1", containerNumber: "MSKU1" },
        { id: "c2", containerNumber: "MSKU1" },
      ],
    });
    const writer = await buildWriter(prisma);

    await expect(writer.apply(command)).rejects.toThrow(ConflictException);
  });

  it("箱号尚未产生时才按旧备货单号查找兼容记录", async () => {
    const { prisma, transaction } = buildPrisma();
    const writer = await buildWriter(prisma);

    await writer.apply({ ...command, containerNumber: null });

    expect(transaction.containerRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a", orderNumber: "SO-1" },
      }),
    );
  });

  it("同一批次的另一备货单复用绑定货柜且不覆盖旧兼容锚", async () => {
    const { prisma, transaction } = buildPrisma({
      binding: {
        containerRecord: {
          id: "c-existing",
          containerNumber: "MSKU1",
          replenishmentOrderId: "o-legacy-anchor",
        },
      },
    });
    const writer = await buildWriter(prisma);

    await expect(writer.apply(command)).resolves.toMatchObject({
      containerRecordId: "c-existing",
      created: false,
    });
    expect(transaction.containerRecord.findMany).not.toHaveBeenCalled();
    expect(transaction.containerRecord.update).toHaveBeenCalledWith({
      where: { id: "c-existing" },
      data: {
        containerNumber: "MSKU1",
      },
    });
  });

  it("不同批次的新备货单遇到历史同箱号时要求明确解析实例", async () => {
    const { prisma, transaction } = buildPrisma({
      sameNumberContainers: [
        {
          id: "historical-container",
          containerNumber: "MSKU1",
          replenishmentOrderId: "historical-order",
        },
      ],
    });
    const writer = await buildWriter(prisma);

    await expect(
      writer.apply({ ...command, sourceBatchId: "batch2" }),
    ).rejects.toThrow("CONTAINER_INSTANCE_RESOLUTION_REQUIRED");

    expect(transaction.containerRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a", orderNumber: "SO-1" },
      }),
    );
    expect(transaction.containerRecord.create).not.toHaveBeenCalled();
  });

  it("共享货柜收到冲突时间事实时明确拒绝而不覆盖当前事实", async () => {
    const currentFact = {
      factCode: "customs_clearance_completed" as const,
      timeKind: "actual" as const,
      captureSource: "controlled_import" as const,
      eventCode: "container_customs_completed",
      rawValue: "2026-04-09 21:58:00",
      occurredAtUtc: new Date("2026-04-09T19:58:00Z"),
      sourceUtcOffset: "+02:00",
      sourceSystem: "legacy-lms",
      authoritySystem: "customs-authority",
      sourceStatus: "已完成",
      evidenceRef: "11111111-1111-4111-8111-111111111111",
      derivationRuleVersion: null,
    };
    const { prisma, transaction } = buildPrisma({
      binding: {
        containerRecord: {
          id: "c-existing",
          containerNumber: "MSKU1",
          replenishmentOrderId: "o-legacy-anchor",
        },
      },
      currentFacts: [currentFact],
    });
    const writer = await buildWriter(prisma);

    await expect(
      writer.apply({
        ...command,
        timeFacts: [
          {
            ...currentFact,
            sourceRowId: "r1",
            rawValue: "2026-04-09 22:58:00",
            occurredAtUtc: new Date("2026-04-09T20:58:00Z"),
            nodeCode: "customs_clearance",
            mappingVersion: "1.3.0",
          },
        ],
      }),
    ).rejects.toThrow("SHARED_CONTAINER_TIME_FACT_CONFLICT");
    expect(transaction.shipmentTimeFact.updateMany).not.toHaveBeenCalled();
    expect(transaction.shipmentTimeFact.createMany).not.toHaveBeenCalled();
  });
});
