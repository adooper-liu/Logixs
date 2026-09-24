import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaShipmentReadRepository } from "./prisma-shipment-read.repository";

const SHIPMENT_ID = "11111111-1111-4111-8111-111111111111";
const CONTAINER_ID = "22222222-2222-4222-8222-222222222222";
const LINK_ID = "33333333-3333-4333-8333-333333333333";
const CARGO_ID = "44444444-4444-4444-8444-444444444444";
const HANDOFF_ID = "55555555-5555-4555-8555-555555555555";
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666";
const REFERENCE_ID = "77777777-7777-4777-8777-777777777777";

const baseShipment = {
  id: SHIPMENT_ID,
  shipmentNumber: "SHIP-001",
  transportMode: "ocean",
  carrierCode: "HMM",
  vesselName: "ONE TRUTH",
  voyageNumber: "V001",
  originCountryCode: "CN",
  originUnlocode: "CNNGB",
  destinationCountryCode: "US",
  destinationUnlocode: "USLAX",
  cargoOwnerId: "cb0d6214-2f8b-5de6-a8e4-afcc0411f4d3",
  cargoOwner: {
    legalName: "AOSOM LLC",
    salesCountry: { alpha2: "US" },
  },
  atdAt: new Date("2026-09-22T10:00:00.000Z"),
  etaAt: new Date("2026-10-10T10:00:00.000Z"),
  currentLifecycleStatus: "departed",
  lifecycleVersion: 2,
  relationshipVersion: 1,
  updatedAt: new Date("2026-09-23T10:00:00.000Z"),
};

describe("PrismaShipmentReadRepository", () => {
  it("lists only tenant-scoped Shipments and reports ready from matching frozen flows", async () => {
    const prisma = prismaMock();
    prisma.shipment.findMany.mockResolvedValue([
      {
        ...baseShipment,
        containerLinks: [{ containerRecordId: CONTAINER_ID }],
        cargoLines: [{ id: CARGO_ID }],
        lifecycleFlows: [
          {
            containerId: CONTAINER_ID,
            definitionCode: "post_departure_ocean",
            definitionVersion: 1,
            shipmentRelationshipVersion: 1,
          },
        ],
      },
    ]);
    prisma.outboxMessage.findMany.mockResolvedValue([]);
    prisma.inboxMessage.findMany.mockResolvedValue([]);
    const repository = new PrismaShipmentReadRepository(prisma as never);

    await expect(
      repository.list({
        tenantId: "tenant-1",
        status: "departed",
        take: 51,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: SHIPMENT_ID,
        activeContainerCount: 1,
        activeCargoLineCount: 1,
        lifecycleInitializationState: "ready",
        salesCountryCode: "US",
        cargoOwnerName: "AOSOM LLC",
        cargoOwnerReferenceId: "cb0d6214-2f8b-5de6-a8e4-afcc0411f4d3",
      }),
    ]);
    expect(prisma.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          currentLifecycleStatus: "departed",
        }),
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
  });

  it("maps current detail facts and exposes a dead-lettered lifecycle initialization", async () => {
    const prisma = prismaMock();
    prisma.shipment.findFirst.mockResolvedValue({
      ...baseShipment,
      containerLinks: [
        {
          id: LINK_ID,
          containerRecordId: CONTAINER_ID,
          version: 1,
          containerRecord: {
            containerNumber: "HMMU4207629",
            containerTypeCode: "40HC",
            sealNumber: "SEAL-1",
            currentStatus: "shipped",
          },
        },
      ],
      cargoLines: [
        {
          id: CARGO_ID,
          lineNo: 1,
          productSkuId: null,
          productNumberSnapshot: "SKU-001",
          quantity: new Prisma.Decimal("10"),
          quantityUnit: "carton",
          packageCount: new Prisma.Decimal("10"),
          packageUnit: "carton",
          grossWeight: new Prisma.Decimal("100.5"),
          weightUnit: "kg",
          volume: new Prisma.Decimal("2.5"),
          volumeUnit: "m3",
          replenishmentOrderLineId: "line-1",
          sourceLineId: "source-line-1",
          version: 1,
        },
      ],
      transportDocuments: [
        {
          id: DOCUMENT_ID,
          documentType: "mbl",
          documentNumber: "MBL-001",
          scac: "HDMU",
          parentDocumentId: null,
          version: 1,
          effectiveFrom: new Date("2026-09-22T10:00:00.000Z"),
          containerLinks: [{ containerRecordId: CONTAINER_ID }],
        },
      ],
      upstreamReferences: [
        {
          id: REFERENCE_ID,
          containerRecordId: CONTAINER_ID,
          shipmentCargoLineId: CARGO_ID,
          referenceType: "stocking_order",
          sourceSystem: "packing-platform",
          sourceRecordId: "26DSC01811",
          sourceVersion: "1",
          sourceLineId: "source-line-1",
          version: 1,
        },
      ],
      handoffs: [
        {
          id: HANDOFF_ID,
          handoffVersion: 1,
          sourceSystem: "packing-platform",
          status: "accepted",
          occurredAt: new Date("2026-09-22T10:00:00.000Z"),
          traceId: "trace-1",
        },
      ],
      lifecycleFlows: [],
    });
    prisma.containerCargoAllocation.findMany.mockResolvedValue([
      {
        shipmentCargoLineId: CARGO_ID,
        allocatedQuantity: new Prisma.Decimal("10"),
        quantityUnit: "carton",
        packageCount: new Prisma.Decimal("10"),
        packageUnit: "carton",
        grossWeight: new Prisma.Decimal("100.5"),
        weightUnit: "kg",
        volume: new Prisma.Decimal("2.5"),
        volumeUnit: "m3",
        allocationSet: { containerRecordId: CONTAINER_ID },
      },
    ]);
    prisma.outboxMessage.findMany.mockResolvedValue([
      {
        aggregateId: SHIPMENT_ID,
        eventId: "event-1",
        state: "published",
        lastErrorCode: null,
      },
    ]);
    prisma.inboxMessage.findMany.mockResolvedValue([
      {
        messageId: "event-1",
        state: "dead_letter",
        lastErrorCode: "POST_DEPARTURE_RELATIONSHIP_VERSION_CONFLICT",
      },
    ]);
    const repository = new PrismaShipmentReadRepository(prisma as never);

    const detail = await repository.findById({
      tenantId: "tenant-1",
      id: SHIPMENT_ID,
    });

    expect(detail).toMatchObject({
      shipment: {
        id: SHIPMENT_ID,
        lifecycleInitializationState: "manual_review",
      },
      containers: [
        {
          containerRecordId: CONTAINER_ID,
          currentNodeCode: null,
          allocations: [
            { shipmentCargoLineId: CARGO_ID, allocatedQuantity: "10" },
          ],
        },
      ],
      cargoLines: [{ id: CARGO_ID, quantity: "10" }],
      transportDocuments: [
        { id: DOCUMENT_ID, containerRecordIds: [CONTAINER_ID] },
      ],
      upstreamReferences: [{ id: REFERENCE_ID }],
      lifecycleInitialization: {
        state: "manual_review",
        activeContainerCount: 1,
        initializedContainerCount: 0,
        lastErrorCode: "POST_DEPARTURE_RELATIONSHIP_VERSION_CONFLICT",
      },
    });
    expect(prisma.shipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", id: SHIPMENT_ID },
      }),
    );
  });
});

function prismaMock() {
  return {
    shipment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    containerCargoAllocation: { findMany: vi.fn() },
    outboxMessage: { findMany: vi.fn() },
    inboxMessage: { findMany: vi.fn() },
  };
}
