import type { ShipmentHandoffCommandV1 } from "@logix/contracts";
import { describe, expect, it, vi } from "vitest";
import { PrismaShipmentHandoffConflictInspector } from "./prisma-shipment-handoff-conflict-inspector";

const command: ShipmentHandoffCommandV1 = {
  contractVersion: "shipment-handoff.v1",
  tenantId: "70000000-0000-4000-8000-000000000001",
  sourceProfile: "api_v1",
  source: {
    channel: "api",
    system: "source-a",
    externalHandoffId: "handoff-1",
    handoffVersion: 1,
    occurredAt: "2026-09-23T01:00:00Z",
    idempotencyKey: "source-a:handoff-1:1",
    correlationId: "70000000-0000-4000-8000-000000000002",
    traceId: "trace-1",
  },
  shipment: {
    externalShipmentId: "shipment-1",
    shipmentNumber: "SHIP-1",
    transportMode: "ocean",
    carrierCode: "HMM",
    vesselName: "YM MASCULINITY",
    voyageNumber: "108E",
    originPortCode: "CNNGB",
    destinationPortCode: "CAVAN",
    destinationCountryCode: "CA",
    departureProof: {
      kind: "authoritative_departed_status",
      sourceStatus: "DEPARTED",
      authorityPolicyRef: "source-a-departed-v1",
      evidenceRef: "70000000-0000-4000-8000-000000000003",
    },
  },
  billsOfLading: [
    {
      referenceId: "mbl-1",
      documentType: "mbl",
      documentNumber: "NBOZ9FF56400",
      version: 1,
    },
  ],
  containers: [
    {
      referenceId: "container-1",
      externalContainerId: "container-source-1",
      containerNumber: "HMMU4956442",
      containerTypeCode: "40HQ",
      billReferences: ["mbl-1"],
      upstreamReferences: [],
      cargoAllocations: [
        {
          sourceLineId: "line-1",
          productNumber: "331-054V00OG",
          quantity: "20",
          quantityUnit: "piece",
        },
      ],
    },
  ],
  evidenceReferences: ["70000000-0000-4000-8000-000000000003"],
};

function prismaMock() {
  return {
    shipmentHandoffRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    shipment: { findUnique: vi.fn().mockResolvedValue(null) },
    cargoOwnerReference: { findFirst: vi.fn().mockResolvedValue(null) },
    containerSourceIdentity: { findUnique: vi.fn().mockResolvedValue(null) },
    containerStuffingSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    shipmentContainerLink: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

describe("PrismaShipmentHandoffConflictInspector", () => {
  it("recognizes an identical stored handoff as a duplicate", async () => {
    const prisma = prismaMock();
    prisma.shipmentHandoffRecord.findMany.mockResolvedValue([
      { id: "handoff-existing", payloadHash: "a".repeat(64) },
    ]);
    const inspector = new PrismaShipmentHandoffConflictInspector(
      prisma as never,
    );

    await expect(inspector.inspect(command, "a".repeat(64))).resolves.toEqual({
      duplicate: true,
      issues: [],
    });
  });

  it("rejects an ambiguous replay identity that resolves to two handoffs", async () => {
    const prisma = prismaMock();
    prisma.shipmentHandoffRecord.findMany.mockResolvedValue([
      { id: "handoff-by-key", payloadHash: "a".repeat(64) },
      { id: "handoff-by-source", payloadHash: "a".repeat(64) },
    ]);
    const inspector = new PrismaShipmentHandoffConflictInspector(
      prisma as never,
    );

    await expect(inspector.inspect(command, "a".repeat(64))).resolves.toEqual({
      duplicate: false,
      issues: [
        expect.objectContaining({ code: "IDEMPOTENCY_PAYLOAD_CONFLICT" }),
      ],
    });
  });

  it("reports a missing predecessor before accepting a correction", async () => {
    const prisma = prismaMock();
    const inspector = new PrismaShipmentHandoffConflictInspector(
      prisma as never,
    );
    const correction: ShipmentHandoffCommandV1 = {
      ...command,
      source: {
        ...command.source,
        handoffVersion: 2,
        supersedesExternalHandoffId: command.source.externalHandoffId,
      },
      shipment: {
        ...command.shipment,
        expectedRelationshipVersion: 1,
      },
    };

    const result = await inspector.inspect(correction, "d".repeat(64));

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "SUPERSEDED_HANDOFF_NOT_FOUND" }),
    );
  });

  it("reports an active Shipment conflict for the resolved container identity", async () => {
    const prisma = prismaMock();
    prisma.containerSourceIdentity.findUnique.mockResolvedValue({
      containerRecordId: "container-record-1",
    });
    prisma.shipmentContainerLink.findFirst.mockResolvedValue({
      shipmentId: "another-shipment",
    });
    const inspector = new PrismaShipmentHandoffConflictInspector(
      prisma as never,
    );

    await expect(inspector.inspect(command, "b".repeat(64))).resolves.toEqual({
      duplicate: false,
      issues: [
        expect.objectContaining({
          code: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
          subjectRef: "container-1",
        }),
      ],
    });
  });

  it("reports source and shipment-number ownership conflicts before commit", async () => {
    const prisma = prismaMock();
    prisma.shipment.findUnique
      .mockResolvedValueOnce({
        id: "shipment-existing",
        relationshipVersion: 1,
      })
      .mockResolvedValueOnce({ id: "shipment-by-number" });
    const inspector = new PrismaShipmentHandoffConflictInspector(
      prisma as never,
    );

    const result = await inspector.inspect(command, "c".repeat(64));

    expect(result.issues.map(({ code }) => code)).toEqual([
      "SHIPMENT_SOURCE_IDENTITY_CONFLICT",
      "SHIPMENT_NUMBER_CONFLICT",
    ]);
  });

  it("reports an unknown or mismatched cargo owner before commit", async () => {
    const prisma = prismaMock();
    const inspector = new PrismaShipmentHandoffConflictInspector(
      prisma as never,
    );
    const cargoOwnerCommand: ShipmentHandoffCommandV1 = {
      ...command,
      shipment: {
        ...command.shipment,
        salesCountryCode: "GB",
        cargoOwnerReferenceId: "661238b9-39e3-55e5-9023-25f4c790f864",
        cargoOwnerName: "MH STAR UK LTD",
      },
    };

    const result = await inspector.inspect(cargoOwnerCommand, "e".repeat(64));

    expect(result.issues).toContainEqual({
      code: "UNKNOWN_REFERENCE_CODE",
      messageKey: "shipment_handoff_cargo_owner_mapping_required",
      subjectRef: "MH STAR UK LTD",
      fieldCodes: ["cargo_owner_reference_id", "sales_country_code"],
    });
  });
});
