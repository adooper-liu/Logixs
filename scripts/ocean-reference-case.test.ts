import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  auditReferenceCase,
  assertReferenceApply,
} from "./ocean-reference-case";

import { normalizeReplaceContainerCargoAllocationsCommand } from "../apps/api/src/modules/shipment-registry/domain/container-cargo-allocation";

import { normalizeContainerStuffingSnapshotCommand } from "../apps/api/src/modules/shipment-registry/domain/container-stuffing-snapshot";
import { normalizeContainerDispatchSnapshotCommand } from "../apps/api/src/modules/shipment-registry/domain/container-dispatch-snapshot";

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../database/seeds/fixtures/ocean-reference-case-v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function auditPrisma() {
  const many = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  const prisma = {
    containerRecord: {
      findFirst: vi.fn().mockResolvedValue({
        id: fixture.containerId,
        containerNumber: fixture.containerNumber,
        orderNumber: fixture.orderNumber,
        replenishmentOrderId: "order",
        currentStatus: "in_transit",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    shipment: {
      findFirst: vi.fn().mockResolvedValue({
        id: fixture.shipmentId,
        sourceSystem: "development_demo.retained_source_package",
        vesselName: fixture.retained.vesselName,
        voyageNumber: fixture.retained.voyageNumber,
        carrierCode: fixture.retained.carrierCode,
        originUnlocode: fixture.retained.originUnlocode,
        destinationUnlocode: fixture.retained.destinationUnlocode,
        atdAt: null,
      }),
    },
    replenishmentOrder: {
      findUnique: vi.fn().mockResolvedValue({ id: "order" }),
    },
    shipmentContainerLink: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "link", shipmentId: fixture.shipmentId }]),
    },
    shipmentTransportDocument: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "document",
          documentType: "hbl",
          documentNumber: fixture.retained.houseBillNumber,
        },
      ]),
    },
    shipmentContainerDocumentLink: many(),
    replenishmentOrderLine: many(),
    containerCargoAllocationSet: many(),
    containerStuffingSnapshot: many(),
    containerDispatchSnapshot: many(),
    shipmentUpstreamReference: {
      ...many(),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    evidenceRecord: { findUnique: vi.fn().mockResolvedValue(null) },
    shipmentCargoLine: many(),
    lifecycleDateFact: many(),
    oceanOperationsSourceReview: many(),
    oceanOperationsArrivalPreparationResult: many(),
  };
  return { prisma };
}

describe("single ocean reference case", () => {
  it("rejects apply without an explicit local target and matching scenario confirmation", () => {
    expect(() =>
      assertReferenceApply(
        {
          connectionString:
            "postgresql://u:p@localhost:5433/logix?schema=public",
          mode: "audit",
        },
        fixture,
      ),
    ).toThrow();
    expect(() =>
      assertReferenceApply(
        {
          connectionString:
            "postgresql://u:p@remote.example.com:5433/logix?schema=public",
          mode: "apply",
          confirm: fixture.scenarioVersion,
        },
        fixture,
      ),
    ).toThrow();
    expect(() =>
      assertReferenceApply(
        {
          connectionString:
            "postgresql://u:p@localhost:5433/logix?schema=public",
          mode: "apply",
          confirm: "wrong",
        },
        fixture,
      ),
    ).toThrow();
  });

  it("rejects altered scenarios before any database access", async () => {
    await expect(
      auditReferenceCase({} as never, {
        ...fixture,
        containerId: "another-container",
      }),
    ).rejects.toThrow("REFERENCE_SCENARIO_CONFLICT");
  });

  it("requires the exact audit hash before application", () => {
    expect(() =>
      assertReferenceApply(
        {
          connectionString:
            "postgresql://u:p@localhost:5433/logix?schema=public",
          mode: "apply",
          confirm: fixture.scenarioVersion,
        },
        fixture,
      ),
    ).toThrow("REFERENCE_APPLY_NOT_AUTHORIZED");
  });

  it("rejects conflicting snapshot payloads during audit before any apply stage", async () => {
    const { prisma } = auditPrisma();
    prisma.containerCargoAllocationSet.findMany.mockResolvedValueOnce([
      {
        id: "allocation",
        idempotencyKey: "ocean-reference-case-v1:allocation",
        state: "active",
        version: 1,
        payloadHash: "wrong",
        allocations: [],
      },
    ]);
    const result = await auditReferenceCase(prisma as never, fixture);
    expect(result.conflicts).toContain("REFERENCE_ALLOCATION_CONFLICT");
  });

  it("rejects changed allocation content even if the stored payload hash is unchanged", async () => {
    const { prisma } = auditPrisma();
    const lines = fixture.synthetic.lines.map(
      (l: { productNumber: string; quantity: string }, i: number) => ({
        id: `72000000-0000-4000-8000-00000000000${i}`,
        sourceBatchId: "ocean-reference-case-v1:lines",
        sourceRowId: l.productNumber,
        productNumber: l.productNumber,
        shippedQuantity: l.quantity,
        quantityUnit: "piece",
        isCurrent: true,
        productSkuId: `sku-${i}`,
      }),
    );
    prisma.replenishmentOrderLine.findMany.mockResolvedValue(lines);
    const expected = normalizeReplaceContainerCargoAllocationsCommand({
      tenantId: fixture.tenantId,
      containerRecordId: fixture.containerId,
      expectedVersion: 0,
      ingestionChannel: "file_import",
      sourceSystem: fixture.sourceSystem,
      evidenceRefs: ["71000000-0000-4000-8000-000000000020"],
      idempotencyKey: "ocean-reference-case-v1:allocation",
      allocations: lines.map((l: { id: string; shippedQuantity: string }) => ({
        replenishmentOrderLineId: l.id,
        allocatedQuantity: l.shippedQuantity,
        quantityUnit: "piece",
      })),
    });
    prisma.containerCargoAllocationSet.findMany.mockResolvedValue([
      {
        id: "allocation",
        state: "active",
        version: 1,
        idempotencyKey: "ocean-reference-case-v1:allocation",
        payloadHash: expected.payloadHash,
        allocations: [],
      },
    ]);
    expect(
      (await auditReferenceCase(prisma as never, fixture)).conflicts,
    ).toContain("REFERENCE_ALLOCATION_CONFLICT");
  });

  it("rejects cargo with correct text but a different replenishment line", async () => {
    const { prisma } = auditPrisma();
    prisma.shipmentCargoLine.findMany.mockResolvedValue([
      {
        sourceLineId: "DEMO-OCEAN-001",
        productNumberSnapshot: "DEMO-OCEAN-001",
        quantity: "600",
        quantityUnit: "piece",
        replenishmentOrderLineId: "wrong-line",
        productSkuId: null,
      },
    ]);
    expect(
      (await auditReferenceCase(prisma as never, fixture)).conflicts,
    ).toContain("REFERENCE_SHIPMENT_CARGO_CONFLICT");
  });

  it("rejects an inactive fixed provenance identity before any writes", async () => {
    const { prisma } = auditPrisma();
    Object.assign(prisma.shipmentUpstreamReference, {
      findUnique: vi.fn().mockResolvedValue({
        id: "71000000-0000-4000-8000-000000000021",
        state: "superseded",
      }),
    });
    expect(
      (await auditReferenceCase(prisma as never, fixture)).conflicts,
    ).toContain("REFERENCE_PROVENANCE_CONFLICT");
  });

  it("accepts persisted snapshot rows without a command-only contractVersion column", async () => {
    const { prisma } = auditPrisma();
    const common = {
      tenantId: fixture.tenantId,
      containerRecordId: fixture.containerId,
      expectedVersion: 0,
      ingestionChannel: "file_import" as const,
      sourceSystem: fixture.sourceSystem,
      evidenceRefs: ["71000000-0000-4000-8000-000000000020"],
    };
    const lines = fixture.synthetic.lines.map(
      (l: { productNumber: string; quantity: string }, i: number) => ({
        id: `72000000-0000-4000-8000-00000000000${i}`,
        sourceBatchId: "ocean-reference-case-v1:lines",
        productNumber: l.productNumber,
        shippedQuantity: l.quantity,
        quantityUnit: "piece",
        isCurrent: true,
      }),
    );
    const allocation = {
      ...normalizeReplaceContainerCargoAllocationsCommand({
        ...common,
        idempotencyKey: "ocean-reference-case-v1:allocation",
        allocations: lines.map(
          (l: { id: string; shippedQuantity: string }) => ({
            replenishmentOrderLineId: l.id,
            allocatedQuantity: l.shippedQuantity,
            quantityUnit: "piece",
          }),
        ),
      }),
      id: "73000000-0000-4000-8000-000000000001",
      version: 1,
      state: "active",
    };
    const stuffingCommand = normalizeContainerStuffingSnapshotCommand({
      ...common,
      allocationSetId: allocation.id,
      allocationSetVersion: 1,
      containerNumber: fixture.containerNumber,
      sealNumber: fixture.synthetic.sealNumber,
      packageCount: 911,
      grossWeight: "12364",
      grossWeightUnit: "KGM",
      netWeight: null,
      volume: "66.26",
      volumeUnit: "MTQ",
      vgm: fixture.synthetic.vgm,
      actorId: "development_demo",
      reasonCode: "synthetic_initial_conditions",
      idempotencyKey: "ocean-reference-case-v1:stuffing",
    });
    const stuffing = {
      ...stuffingCommand,
      id: "73000000-0000-4000-8000-000000000002",
      version: 1,
      state: "active",
      vgmWeight: "16364",
      vgmMethod: "method_1",
      vgmVerifiedAt: new Date(fixture.synthetic.vgm.verifiedAt),
    };
    const { contractVersion: _, ...dispatch } =
      normalizeContainerDispatchSnapshotCommand({
        ...common,
        stuffingSnapshotId: stuffing.id,
        stuffingSnapshotVersion: 1,
        bookingNumber: fixture.synthetic.bookingNumber,
        carrierCode: "MSC",
        vesselName: fixture.retained.vesselName,
        voyageNumber: "HD638A",
        masterBillNumber: null,
        houseBillNumber: fixture.retained.houseBillNumber,
        vgmHandoffState: "accepted",
        actorId: "development_demo",
        reasonCode: "synthetic_initial_conditions",
        idempotencyKey: "ocean-reference-case-v1:dispatch",
      }) as ReturnType<typeof normalizeContainerDispatchSnapshotCommand> & {
        contractVersion: string;
      };
    prisma.replenishmentOrderLine.findMany.mockResolvedValue(lines);
    prisma.containerCargoAllocationSet.findMany.mockResolvedValue([allocation]);
    prisma.containerStuffingSnapshot.findMany.mockResolvedValue([stuffing]);
    prisma.containerDispatchSnapshot.findMany.mockResolvedValue([
      { ...dispatch, version: 1, state: "active" },
    ]);
    expect(
      (await auditReferenceCase(prisma as never, fixture)).conflicts,
    ).not.toContain("REFERENCE_DISPATCH_CONFLICT");
  });

  it("audits a missing identity without issuing any writes or inventing a new container", async () => {
    const read = vi.fn().mockResolvedValue(null);
    const prisma = {
      containerRecord: { findFirst: read },
      shipment: { findFirst: read },
    };
    const result = await auditReferenceCase(prisma as never, fixture);
    expect(result.conflicts).toContain("REFERENCE_IDENTITY_MISSING");
    expect(result.ready).toBe(false);
    expect(result.mode).toBe("audit");
  });
});
