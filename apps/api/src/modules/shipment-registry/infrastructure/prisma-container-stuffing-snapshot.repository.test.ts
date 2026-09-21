import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ContainerStuffingSnapshotConflictError,
  normalizeContainerStuffingSnapshotCommand,
} from "../domain/container-stuffing-snapshot";
import { PrismaContainerStuffingSnapshotRepository } from "./prisma-container-stuffing-snapshot.repository";

const command = normalizeContainerStuffingSnapshotCommand({
  tenantId: "tenant-a",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  expectedVersion: 0,
  allocationSetId: "22222222-2222-4222-8222-222222222222",
  allocationSetVersion: 3,
  containerNumber: "KOCU4960726",
  sealNumber: "25H1059249",
  packageCount: 524,
  grossWeight: "8319",
  grossWeightUnit: "KGM",
  netWeight: "8000",
  volume: "66.74",
  volumeUnit: "MTQ",
  vgm: null,
  ingestionChannel: "manual_ui",
  sourceSystem: "logix.web",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "operator-a",
  reasonCode: "stuffing_confirmed",
  idempotencyKey: "stuffing:container-1:v1",
});

function decimal(value: string) {
  return { toString: () => value };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    containerRecordId: command.containerRecordId,
    version: 1,
    allocationSetId: command.allocationSetId,
    allocationSetVersion: command.allocationSetVersion,
    containerNumber: command.containerNumber,
    sealNumber: command.sealNumber,
    packageCount: command.packageCount,
    grossWeight: decimal(command.grossWeight),
    grossWeightUnit: "KGM",
    netWeight: decimal(command.netWeight!),
    volume: decimal(command.volume),
    volumeUnit: "MTQ",
    vgmWeight: null,
    vgmWeightUnit: null,
    vgmMethod: null,
    vgmVerifiedAt: null,
    evidenceRefs: command.evidenceRefs,
    actorId: command.actorId,
    reasonCode: command.reasonCode,
    payloadHash: command.payloadHash,
    createdAt: new Date("2026-01-23T01:15:00.000Z"),
    ...overrides,
  };
}

function buildPrisma(options?: {
  existing?: ReturnType<typeof row>;
  containerNumber?: string | null;
  currentVersion?: number;
  allocationVersion?: number;
}) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockAcquired: 1 }]),
    containerRecord: {
      findUnique: vi.fn().mockResolvedValue({
        id: command.containerRecordId,
        containerNumber: options?.containerNumber ?? null,
      }),
      update: vi.fn().mockResolvedValue({ id: command.containerRecordId }),
    },
    containerCargoAllocationSet: {
      findFirst: vi.fn().mockResolvedValue({
        id: command.allocationSetId,
        version: options?.allocationVersion ?? command.allocationSetVersion,
      }),
    },
    containerStuffingSnapshot: {
      findUnique: vi.fn().mockResolvedValue(options?.existing ?? null),
      findFirst: vi.fn().mockResolvedValue(
        options?.currentVersion
          ? {
              id: "55555555-5555-4555-8555-555555555555",
              version: options.currentVersion,
            }
          : null,
      ),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue(row()),
    },
  };
  return {
    transaction,
    prisma: {
      containerStuffingSnapshot: {
        findFirst: vi.fn().mockResolvedValue(row()),
      },
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
      PrismaContainerStuffingSnapshotRepository,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(PrismaContainerStuffingSnapshotRepository);
}

describe("PrismaContainerStuffingSnapshotRepository", () => {
  it("锁定货柜与装载版本后原子绑定箱号并创建首版快照", async () => {
    const { prisma, transaction } = buildPrisma();
    const repository = await buildRepository(prisma);

    await expect(repository.replace(command)).resolves.toMatchObject({
      version: 1,
      duplicate: false,
      sealNumber: "25H1059249",
    });
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(3);
    expect(transaction.containerRecord.update).toHaveBeenCalledWith({
      where: {
        id_tenantId: {
          id: command.containerRecordId,
          tenantId: command.tenantId,
        },
      },
      data: { containerNumber: command.containerNumber },
    });
    expect(transaction.containerStuffingSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 1,
          state: "active",
          allocationSetId: command.allocationSetId,
          evidenceRefs: command.evidenceRefs,
        }),
      }),
    );
  });

  it("同键同载荷重放返回原快照且不写入", async () => {
    const { prisma, transaction } = buildPrisma({ existing: row() });
    const repository = await buildRepository(prisma);

    await expect(repository.replace(command)).resolves.toMatchObject({
      snapshotId: "44444444-4444-4444-8444-444444444444",
      duplicate: true,
    });
    expect(transaction.containerRecord.findUnique).not.toHaveBeenCalled();
    expect(transaction.containerStuffingSnapshot.create).not.toHaveBeenCalled();
  });

  it("拒绝同键异载荷、过期快照版本、装载版本变化和箱号冲突", async () => {
    const idempotency = buildPrisma({
      existing: row({ payloadHash: "f".repeat(64) }),
    });
    await expect(
      (await buildRepository(idempotency.prisma)).replace(command),
    ).rejects.toThrow("CONTAINER_STUFFING_IDEMPOTENCY_CONFLICT");

    const stale = buildPrisma({ currentVersion: 2 });
    await expect(
      (await buildRepository(stale.prisma)).replace(command),
    ).rejects.toThrow("CONTAINER_STUFFING_VERSION_CONFLICT");

    const allocation = buildPrisma({ allocationVersion: 4 });
    await expect(
      (await buildRepository(allocation.prisma)).replace(command),
    ).rejects.toThrow("CONTAINER_STUFFING_ALLOCATION_VERSION_CONFLICT");

    const identity = buildPrisma({ containerNumber: "BMOU5662613" });
    await expect(
      (await buildRepository(identity.prisma)).replace(command),
    ).rejects.toThrow(ContainerStuffingSnapshotConflictError);
  });

  it("读取当前快照并显式映射 Decimal、时间和 VGM", async () => {
    const { prisma } = buildPrisma();
    const repository = await buildRepository(prisma);

    await expect(
      repository.findCurrent({
        tenantId: command.tenantId,
        containerRecordId: command.containerRecordId,
      }),
    ).resolves.toMatchObject({
      grossWeight: "8319",
      volume: "66.74",
      vgm: null,
      duplicate: false,
    });
  });
});
