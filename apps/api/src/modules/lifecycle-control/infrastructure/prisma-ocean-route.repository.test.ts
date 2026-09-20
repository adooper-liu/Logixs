import { describe, expect, it, vi } from "vitest";
import { PrismaOceanRouteRepository } from "./prisma-ocean-route.repository";

const input = {
  routePlanId: "11111111-1111-4111-8111-111111111111",
  segmentIds: ["22222222-2222-4222-8222-222222222222"],
  tenantId: "33333333-3333-4333-8333-333333333333",
  containerId: "44444444-4444-4444-8444-444444444444",
  segments: [
    {
      transportMode: "vessel" as const,
      originUnlocode: "CNNGB",
      originTimezone: "Asia/Shanghai",
      destinationLocationType: "port" as const,
      destinationUnlocode: "USLAX",
      destinationTimezone: "America/Los_Angeles",
    },
  ],
  ingestionChannel: "api" as const,
  sourceSystem: "carrier.route-api",
  evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
  expectedVersion: 2,
  idempotencyKey: "route:1:v3",
  traceId: "trace-1",
  payloadHash: "a".repeat(64),
  activatedAt: new Date("2026-09-20T02:00:00Z"),
};

function persistedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: input.routePlanId,
    version: 3,
    payloadHash: input.payloadHash,
    activatedAt: input.activatedAt,
    ingestionChannel: input.ingestionChannel,
    sourceSystem: input.sourceSystem,
    evidenceRefs: input.evidenceRefs,
    actorId: null,
    reasonCode: null,
    segments: [
      {
        id: input.segmentIds[0],
        sequence: 1,
        isFinal: true,
        transportMode: "vessel",
        originUnlocode: "CNNGB",
        originTimezone: "Asia/Shanghai",
        destinationLocationType: "port",
        destinationUnlocode: "USLAX",
        destinationLocationId: null,
        destinationPortCallId: null,
        destinationTimezone: "America/Los_Angeles",
      },
    ],
    ...overrides,
  };
}

describe("PrismaOceanRouteRepository", () => {
  it("只读取指定租户货柜的当前 active 路线", async () => {
    const prisma = {
      oceanRoutePlan: { findFirst: vi.fn().mockResolvedValue(persistedRow()) },
    };
    const repository = new PrismaOceanRouteRepository(prisma as never);
    await expect(
      repository.findCurrent({
        tenantId: input.tenantId,
        containerId: input.containerId,
      }),
    ).resolves.toMatchObject({
      routePlanId: input.routePlanId,
      version: 3,
      evidenceRefs: input.evidenceRefs,
    });
    expect(prisma.oceanRoutePlan.findFirst).toHaveBeenCalledWith({
      where: {
        containerId: input.containerId,
        status: "active",
        container: { tenantId: input.tenantId },
      },
      include: { segments: { orderBy: { sequence: "asc" } } },
    });
  });

  it("锁定货柜后原子失效旧路线并创建下一版本", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: input.containerId }]),
      oceanRoutePlan: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: "old-route", version: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(persistedRow()),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaOceanRouteRepository(prisma as never);

    await expect(repository.replace(input)).resolves.toMatchObject({
      duplicate: false,
      record: { version: 3, segments: [{ isFinal: true, sequence: 1 }] },
    });
    expect(tx.oceanRoutePlan.updateMany).toHaveBeenCalledWith({
      where: { id: "old-route", status: "active", version: 2 },
      data: { status: "superseded", supersededAt: input.activatedAt },
    });
    expect(tx.oceanRoutePlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 3,
        status: "active",
        supersedesRouteId: "old-route",
        ingestionChannel: "api",
        evidenceRefs: input.evidenceRefs,
        segments: {
          create: [
            expect.objectContaining({
              id: input.segmentIds[0],
              sequence: 1,
              isFinal: true,
            }),
          ],
        },
      }),
      include: { segments: { orderBy: { sequence: "asc" } } },
    });
  });

  it("同键同载荷返回原版本且不再次换版", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: input.containerId }]),
      oceanRoutePlan: {
        findUnique: vi.fn().mockResolvedValue(persistedRow()),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    const repository = new PrismaOceanRouteRepository(prisma as never);

    await expect(repository.replace(input)).resolves.toMatchObject({
      duplicate: true,
      record: { routePlanId: input.routePlanId, version: 3 },
    });
    expect(tx.oceanRoutePlan.findFirst).not.toHaveBeenCalled();
    expect(tx.oceanRoutePlan.create).not.toHaveBeenCalled();
  });

  it("同键异载荷和预期版本错误都明确冲突", async () => {
    const duplicateTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: input.containerId }]),
      oceanRoutePlan: {
        findUnique: vi
          .fn()
          .mockResolvedValue(persistedRow({ payloadHash: "b".repeat(64) })),
      },
    };
    const duplicateRepository = new PrismaOceanRouteRepository({
      $transaction: vi.fn(async (fn) => fn(duplicateTx)),
    } as never);
    await expect(duplicateRepository.replace(input)).rejects.toThrow(
      "LIFECYCLE_IDEMPOTENCY_CONFLICT",
    );

    const versionTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: input.containerId }]),
      oceanRoutePlan: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: "old-route", version: 3 }),
      },
    };
    const versionRepository = new PrismaOceanRouteRepository({
      $transaction: vi.fn(async (fn) => fn(versionTx)),
    } as never);
    await expect(versionRepository.replace(input)).rejects.toThrow(
      "LIFECYCLE_VERSION_CONFLICT",
    );
  });
});
