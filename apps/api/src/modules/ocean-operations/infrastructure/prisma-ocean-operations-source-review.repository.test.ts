import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PrismaOceanOperationsSourceReviewRepository } from "./prisma-ocean-operations-source-review.repository";

function makePrisma() {
  type MockRow = {
    tenantId: string;
    idempotencyKey: string;
    version: number;
    [key: string]: unknown;
  };
  type IdempotencyQuery = {
    where: {
      tenantId_idempotencyKey: { tenantId: string; idempotencyKey: string };
    };
  };
  const rows: MockRow[] = [];
  const prisma = {
    containerRecord: {
      findFirst: vi.fn().mockResolvedValue({ id: "container-1" }),
    },
    shipmentTimeFact: {
      findFirst: vi.fn().mockResolvedValue({
        factCode: "departure",
        eventCode: null,
        sourceSystem: "source-workbook",
        sourceBatchId: "20260923",
        sourceStatus: null,
        rawValue: "2026-09-23",
        occurredAtUtc: new Date("2026-09-23T00:00:00.000Z"),
      }),
    },
    shipmentContainerLink: {
      findFirst: vi.fn().mockResolvedValue({ shipmentId: "shipment-1" }),
      findMany: vi.fn().mockResolvedValue([{ shipmentId: "shipment-1" }]),
    },
    $transaction: vi.fn(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    ),
    oceanOperationsSourceReview: {
      findUnique: vi.fn(
        async ({ where }: IdempotencyQuery) =>
          rows.find(
            (row) =>
              row.tenantId === where.tenantId_idempotencyKey.tenantId &&
              row.idempotencyKey ===
                where.tenantId_idempotencyKey.idempotencyKey,
          ) ?? null,
      ),
      findFirst: vi.fn(async () => rows.at(-1) ?? null),
      create: vi.fn(async ({ data }: { data: MockRow }) => {
        rows.push({ ...data });
        return data;
      }),
    },
    oceanOperationsArrivalPreparationResult: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(async ({ data }: { data: MockRow }) => data),
    },
  };
  return prisma;
}

describe("PrismaOceanOperationsSourceReviewRepository", () => {
  it("appends a review and returns duplicate for an idempotent replay", async () => {
    const prisma = makePrisma();
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );
    const input = {
      tenantId: "tenant-a",
      actorId: "operator-a",
      containerId: "container-1",
      sourceObservationId: "shipment-time:1",
      reviewDecision: "review_required" as const,
      reason: "母船身份待补证",
      expectedVersion: 0,
      idempotencyKey: "key-1",
      traceId: "trace-1",
      rawValue: "attacker-controlled-value",
      sourceSystem: "attacker-controlled-source",
      normalizedValue: "not-a-date",
    };
    const first = await service.save(input);
    const replay = await service.save(input);
    expect(first.recordState).toBe("recorded");
    expect(replay.recordState).toBe("duplicate");
    expect(first.review.version).toBe(1);
    expect(
      (
        prisma.oceanOperationsSourceReview.create.mock
          .calls[0]?.[0] as unknown as {
          data: { rawValue: string; shipmentId: string };
        }
      ).data,
    ).toEqual(
      expect.objectContaining({
        rawValue: "2026-09-23",
        shipmentId: "shipment-1",
        normalizedValue: null,
      }),
    );
  });

  it("rejects a stale expected version and never overwrites the first result", async () => {
    const prisma = makePrisma();
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );
    await service.save({
      tenantId: "tenant-a",
      actorId: "operator-a",
      containerId: "container-1",
      sourceObservationId: "shipment-time:1",
      reviewDecision: "reject_observation",
      reason: "来源损坏",
      expectedVersion: 0,
      idempotencyKey: "key-1",
      traceId: "trace-1",
    });
    await expect(
      service.save({
        tenantId: "tenant-a",
        actorId: "operator-b",
        containerId: "container-1",
        sourceObservationId: "shipment-time:2",
        reviewDecision: "review_required",
        reason: "待补证",
        expectedVersion: 0,
        idempotencyKey: "key-2",
        traceId: "trace-2",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects saving when more than one active ocean shipment claims the container", async () => {
    const prisma = makePrisma();
    prisma.shipmentContainerLink.findMany.mockResolvedValue([
      { shipmentId: "shipment-1" },
      { shipmentId: "shipment-2" },
    ]);
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    await expect(
      service.save({
        tenantId: "tenant-a",
        actorId: "operator-a",
        containerId: "container-1",
        sourceObservationId: "shipment-time:1",
        reviewDecision: "review_required",
        reason: "身份待确认",
        expectedVersion: 0,
        idempotencyKey: "ambiguous-key",
        traceId: "trace-ambiguous",
      }),
    ).rejects.toThrow("SHIPMENT_IDENTITY_AMBIGUOUS");
  });

  it("enforces tenant object scope", async () => {
    const prisma = makePrisma();
    prisma.containerRecord.findFirst.mockResolvedValue(null);
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );
    await expect(
      service.save({
        tenantId: "tenant-b",
        actorId: "operator-a",
        containerId: "container-1",
        sourceObservationId: "shipment-time:1",
        reviewDecision: "review_required",
        reason: "待补证",
        expectedVersion: 0,
        idempotencyKey: "key-1",
        traceId: "trace-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps a concurrent idempotency unique race to the existing result", async () => {
    const prisma = makePrisma();
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );
    await service.save({
      tenantId: "tenant-a",
      actorId: "operator-a",
      containerId: "container-1",
      sourceObservationId: "shipment-time:1",
      reviewDecision: "review_required",
      reason: "母船身份待补证",
      expectedVersion: 0,
      idempotencyKey: "key-1",
      traceId: "trace-1",
    });
    prisma.$transaction = vi.fn(async () => {
      throw { code: "P2002" };
    }) as typeof prisma.$transaction;
    const result = await service.save({
      tenantId: "tenant-a",
      actorId: "operator-a",
      containerId: "container-1",
      sourceObservationId: "shipment-time:1",
      reviewDecision: "review_required",
      reason: "母船身份待补证",
      expectedVersion: 0,
      idempotencyKey: "key-1",
      traceId: "trace-2",
    });
    expect(result.recordState).toBe("duplicate");
    expect(result.review.version).toBe(1);
  });

  it("only returns containers backed by current source observations", async () => {
    const observed = {
      id: "container-observed",
      containerNumber: "MEDU7620177",
      currentStatus: "shipped",
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
    };
    const ordinary = {
      id: "container-ordinary",
      containerNumber: "NO-SOURCE",
      currentStatus: "shipped",
      updatedAt: new Date("2026-10-25T01:00:00.000Z"),
    };
    const prisma = {
      shipmentTimeFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              containerRecordId: observed.id,
              factCode: "departure",
              eventCode: null,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "time-1",
              containerRecordId: observed.id,
              rawValue: "2026-09-23",
              timeKind: "actual",
              factCode: "departure",
              eventCode: null,
            },
          ]),
      },
      lifecycleDateFact: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanProviderEventIngestion: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "provider-1",
              containerRecordId: observed.id,
              eventTimeRaw: "2026-11-01",
              timeKind: "estimated",
              rawCode: "ATA",
              canonicalEventCode: "arrival_port",
              authorityDecision: "review_required",
              normalizationKind: "review_required",
            },
          ]),
      },
      containerRecord: {
        findMany: vi.fn().mockResolvedValue([observed, ordinary]),
      },
      oceanOperationsSourceReview: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsArrivalPreparationResult: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      shipmentContainerLink: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    const queue = await service.listQueue({ tenantId: "tenant-a" });

    expect(queue.map((item) => item.containerId)).toEqual([observed.id]);
    expect(queue[0]).toEqual(
      expect.objectContaining({ observationCount: 2, conflictCount: 1 }),
    );
    expect(
      (
        prisma.containerRecord.findMany.mock.calls[0]?.[0] as {
          where: { id: { in: string[] } };
        }
      ).where.id.in,
    ).toEqual([observed.id]);
  });

  it("excludes customs and unloading facts from the ocean queue", async () => {
    const observed = {
      id: "container-ocean",
      containerNumber: "OCEAN-1",
      currentStatus: "in_transit",
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
    };
    const prisma = {
      shipmentTimeFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              containerRecordId: observed.id,
              factCode: "customs_clearance",
              eventCode: "customs_filed",
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "customs-1",
              containerRecordId: observed.id,
              rawValue: "2026-10-01",
              timeKind: "actual",
              factCode: "customs_clearance",
              eventCode: "customs_filed",
            },
          ]),
      },
      lifecycleDateFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              containerId: observed.id,
              nodeCode: "container_unloading",
              eventCode: "unloaded",
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "unload-1",
              containerId: observed.id,
              rawValue: "2026-10-02",
              timeKind: "actual",
              nodeCode: "container_unloading",
              eventCode: "unloaded",
            },
          ]),
      },
      oceanProviderEventIngestion: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsSourceReview: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsArrivalPreparationResult: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      containerRecord: {
        findMany: vi.fn().mockResolvedValue([observed]),
      },
      shipmentContainerLink: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    await expect(service.listQueue({ tenantId: "tenant-a" })).resolves.toEqual(
      [],
    );
    expect(prisma.containerRecord.findMany).not.toHaveBeenCalled();
  });

  it("does not treat unknown or non-ocean event names as ocean observations", async () => {
    const observed = {
      id: "container-non-ocean",
      containerNumber: "NON-OCEAN-1",
      currentStatus: "in_transit",
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
    };
    const prisma = {
      shipmentTimeFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              containerRecordId: observed.id,
              factCode: "customs_arrival",
              eventCode: null,
            },
            {
              containerRecordId: observed.id,
              factCode: "future_unknown_fact",
              eventCode: null,
            },
          ])
          .mockResolvedValueOnce([]),
      },
      lifecycleDateFact: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanProviderEventIngestion: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsSourceReview: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsArrivalPreparationResult: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      containerRecord: { findMany: vi.fn().mockResolvedValue([observed]) },
      shipmentContainerLink: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    await expect(service.listQueue({ tenantId: "tenant-a" })).resolves.toEqual(
      [],
    );
    expect(prisma.containerRecord.findMany).not.toHaveBeenCalled();
  });

  it("keeps an unresolved source date raw without projecting occurredAtUtc", async () => {
    const prisma = {
      containerRecord: {
        findFirst: vi.fn().mockResolvedValue({
          id: "container-1",
          containerNumber: "MEDU7620177",
          currentStatus: "in_transit",
        }),
      },
      shipmentContainerLink: { findMany: vi.fn().mockResolvedValue([]) },
      shipmentTimeFact: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "time-unresolved",
            factCode: "departure",
            eventCode: null,
            sourceSystem: "source-workbook",
            sourceBatchId: "20260923",
            sourceStatus: "unparsed",
            rawValue: "9/23/2026 00:00:00",
            occurredAtUtc: new Date("2026-09-23T00:00:00.000Z"),
            timeKind: "actual",
            evidenceRef: null,
            isCurrent: true,
          },
        ]),
      },
      lifecycleDateFact: { findMany: vi.fn().mockResolvedValue([]) },
      oceanProviderEventIngestion: { findMany: vi.fn().mockResolvedValue([]) },
      oceanOperationsSourceReview: { findMany: vi.fn().mockResolvedValue([]) },
      oceanOperationsArrivalPreparationResult: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    const projection = await service.getProjection("tenant-a", "container-1");

    expect(projection.observations[0]).toEqual(
      expect.objectContaining({
        rawValue: "9/23/2026 00:00:00",
        parseState: "unparsed",
        normalizedValue: null,
      }),
    );
    expect(projection.observations[0]?.normalizedValue).toBeNull();
  });

  it("projects the arrival-preparation context from the unique ocean shipment", async () => {
    const prisma = {
      containerRecord: {
        findFirst: vi.fn().mockResolvedValue({
          id: "container-1",
          containerNumber: "MEDU7620177",
          currentStatus: "in_transit",
          orderNumber: "26DSA01885",
          mainOrderNumber: "26DSA01885",
        }),
      },
      shipmentContainerLink: {
        findMany: vi.fn().mockResolvedValue([
          {
            shipment: {
              id: "shipment-1",
              shipmentNumber: null,
              carrierCode: "MSC",
              vesselName: "MSC MAKALU III",
              voyageNumber: "HD638A",
              originUnlocode: "CNFOC",
              destinationUnlocode: "USSAV",
              etdAt: new Date("2026-09-23T00:00:00.000Z"),
              atdAt: null,
              transportMode: "ocean",
              transportDocuments: [{ documentNumber: "1811F026PE36668R2" }],
              upstreamReferences: [
                {
                  referenceType: "stocking_order",
                  sourceSystem: "retained_source_package",
                  sourceRecordId: "MEDU7620177",
                  sourceVersion: "post-departure-20260923-v1",
                  metadata: {
                    oceanFreightAmount: "3925",
                    oceanFreightCurrency: "USD",
                    oceanFreightSourceReference:
                      "retained-fixture:MEDU7620177:ocean-freight",
                  },
                },
              ],
            },
            state: "active",
            supersededAt: null,
          },
        ]),
      },
      shipmentTimeFact: { findMany: vi.fn().mockResolvedValue([]) },
      lifecycleDateFact: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "eta-1",
            nodeCode: "destination_arrival",
            eventCode: "arrived",
            sourceSystem: "development_demo.retained_source_package",
            mappingVersion: "post-departure-20260923-v1",
            projectionVersion: 1,
            validity: "valid",
            rawValue: "2026-11-01",
            occurredAt: new Date("2026-11-01T05:00:00.000Z"),
            timeKind: "estimated",
            evidenceRefs: ["retained-fixture:MEDU7620177:eta"],
            isCurrent: true,
          },
        ]),
      },
      oceanProviderEventIngestion: { findMany: vi.fn().mockResolvedValue([]) },
      oceanOperationsSourceReview: { findMany: vi.fn().mockResolvedValue([]) },
      oceanOperationsArrivalPreparationResult: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    const projection = await service.getProjection("tenant-a", "container-1");

    expect(projection.shipment).toEqual(
      expect.objectContaining({
        id: "shipment-1",
        number: null,
        carrier: "MSC",
        vessel: "MSC MAKALU III",
        voyage: "HD638A",
        plannedDepartureAt: "2026-09-23T00:00:00.000Z",
        actualDepartureAt: null,
        billNumbers: ["1811F026PE36668R2"],
        origin: { code: "CNFOC", name: "福州" },
        destination: { code: "USSAV", name: "萨凡纳" },
      }),
    );
    expect(projection.shipment).not.toHaveProperty(
      "demonstrationActualDepartureAt",
    );
    expect(projection.shipment).toHaveProperty("actualDepartureSource", null);
    expect(projection.references).toEqual({
      replenishmentOrderNumber: "26DSA01885",
      houseBillNumber: "1811F026PE36668R2",
    });
    expect(projection.observations).toEqual([
      expect.objectContaining({
        semanticKey: "arrived",
        timeKind: "estimated",
        rawValue: "2026-11-01",
      }),
    ]);
    expect(projection.financialProjection.costFee).toEqual(
      expect.objectContaining({
        amount: "3925",
        currency: "USD",
        status: "source_amount_pending_verification",
      }),
    );
    expect(projection.focus.map((item) => item.code)).toEqual([
      "progress", "arrival_change", "route_risk", "information", "coordination",
    ]);
    expect(projection.task.question).not.toContain("能否作为清关");
    expect(projection.downstream.missingFacts).not.toContain("实际到港尚未回流");
    expect(projection.downstream.nextStep).not.toContain("完成本次到港准备判断后等待");
    expect(projection.observations[0]).toEqual(expect.objectContaining({
      nodeCode: "destination_arrival",
    }));
    expect(projection.traceability).toEqual(
      expect.objectContaining({
        sourceVersion: "post-departure-20260923-v1",
        consumer: "customs_arrival_preparation",
      }),
    );
  });

  it("rejects a non-ocean event even when a lifecycle row claims an ocean node", async () => {
    const observed = {
      id: "container-mixed",
      containerNumber: "MIXED-1",
      currentStatus: "in_transit",
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
    };
    const prisma = {
      shipmentTimeFact: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      lifecycleDateFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              containerId: observed.id,
              nodeCode: "ocean_transit",
              eventCode: "container_customs_completed",
            },
          ])
          .mockResolvedValueOnce([]),
      },
      oceanProviderEventIngestion: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsSourceReview: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      oceanOperationsArrivalPreparationResult: {
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      },
      containerRecord: { findMany: vi.fn().mockResolvedValue([observed]) },
      shipmentContainerLink: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new PrismaOceanOperationsSourceReviewRepository(
      prisma as never,
    );

    await expect(service.listQueue({ tenantId: "tenant-a" })).resolves.toEqual(
      [],
    );
  });
});
