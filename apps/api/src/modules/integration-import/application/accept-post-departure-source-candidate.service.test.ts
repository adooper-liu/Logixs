import { describe, expect, it, vi } from "vitest";
import { AcceptPostDepartureSourceCandidateService } from "./accept-post-departure-source-candidate.service";

const packageId = "a".repeat(64);
const tenantId = "demo-real-sample-20260921";
const batchId = "70000000-0000-4000-8000-000000000002";

describe("AcceptPostDepartureSourceCandidateService", () => {
  it("maps prepared standard facts into the V2 standard source Handoff", async () => {
    const prepared = {
      shipmentGrouping: {
        kind: "authorized_new_shipment" as const,
        shipmentNumber: "SHP-20260918-001",
      },
      sourceRecordId: "ERP-20260918-001",
      bookingNumber: "SQSJ26090200041842",
      sealNumber: "26H0407525",
      originPortCode: "CNNGB",
      destinationPortCode: "CAVAN",
      salesCountryCode: "CA",
      cargoOwnerReferenceId: "e47a5b2c-e4c0-5f25-a5eb-f756f1fc3086",
      cargoOwnerName: "AOSOM CANADA INC.",
      estimatedArrivalAt: "2026-10-08T07:00:00.000Z",
      departureProof: {
        kind: "actual_departure_time" as const,
        occurredAt: "2026-09-17T16:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: batchId,
      },
      cargoAllocations: [
        {
          sourceLineId: "BOM-001",
          productNumber: "331-015",
          quantity: "118",
          quantityUnit: "piece" as const,
          packageCount: "118",
          packageUnit: "carton",
          grossWeight: "1404.2",
          weightUnit: "kg" as const,
          volume: "19.63",
          volumeUnit: "m3" as const,
        },
        {
          sourceLineId: "BOM-002",
          productNumber: "842-327V80",
          quantity: "40",
          quantityUnit: "piece" as const,
        },
      ],
      upstreamReferences: [
        {
          referenceType: "stocking_order" as const,
          sourceSystem: "post_departure_source_package",
          sourceRecordId: "26DSC01812",
        },
        {
          referenceType: "stocking_order" as const,
          sourceSystem: "post_departure_source_package",
          sourceRecordId: "26DSC01812",
          sourceLineId: "BOM-001",
        },
        {
          referenceType: "stocking_order" as const,
          sourceSystem: "post_departure_source_package",
          sourceRecordId: "26DSC01813",
          sourceLineId: "BOM-002",
        },
      ],
      billsOfLading: [
        {
          referenceId: "mbl:NBOZ9FF56400",
          documentType: "mbl" as const,
          documentNumber: "NBOZ9FF56400",
          version: 1,
        },
      ],
    };
    const preflightPackage = {
      execute: vi.fn().mockResolvedValue({
        packageId,
        sources: [],
        candidates: [
          {
            candidateRef: "SHP-20260918-001:HMMU4956442",
            decision: "ready",
            containerNumber: "HMMU4956442",
            containerTypeCode: "40HQ",
            packageCount: "504",
            grossWeightKg: "7723",
            volumeM3: "67.25",
            replenishmentOrderNumbers: ["26DSC01812"],
            billNumbers: ["NBOZ9FF56400"],
            carrierCode: "HMM",
            vesselName: "YM MASCULINITY",
            voyageNumber: "108E",
            preparedHandoff: prepared,
            issues: [],
          },
        ],
        totals: {},
        traceId: "trace-preflight",
      }),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue({
        batch: {
          id: batchId,
          parserVersion: "post-departure-standard-v1",
          createdAt: new Date("2026-09-25T00:00:00Z"),
        },
      }),
    };
    const acceptHandoff = {
      accept: vi.fn().mockResolvedValue({
        shipmentId: "70000000-0000-4000-8000-000000000003",
        issues: [],
      }),
    };
    const service = new AcceptPostDepartureSourceCandidateService(
      preflightPackage as never,
      repository as never,
      acceptHandoff as never,
    );

    await service.execute(
      packageId,
      "SHP-20260918-001:HMMU4956442",
      {
        contractVersion: "post-departure-source-candidate-accept.v1",
        packageId,
        sources: [{ kind: "container", batchId }],
        candidateRef: "SHP-20260918-001:HMMU4956442",
        idempotencyKey: "accept:standard:1",
      },
      { tenantId, actorId: "70000000-0000-4000-8000-000000000009" },
    );

    expect(acceptHandoff.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProfile: "standard_departed_import_v1",
        source: expect.objectContaining({
          sourceBatchId: batchId,
          mappingVersion: "post_departure_standard_import.v1",
        }),
        shipment: expect.objectContaining({
          shipmentNumber: "SHP-20260918-001",
          externalShipmentId: "SHP-20260918-001",
          bookingNumber: "SQSJ26090200041842",
          originPortCode: "CNNGB",
          destinationPortCode: "CAVAN",
          salesCountryCode: "CA",
          cargoOwnerName: "AOSOM CANADA INC.",
          departureProof: prepared.departureProof,
        }),
        billsOfLading: prepared.billsOfLading,
        containers: [
          expect.objectContaining({
            externalContainerId: "ERP-20260918-001",
            containerNumber: "HMMU4956442",
            sealNumber: "26H0407525",
            declaredPackageCount: "504",
            declaredGrossWeightKg: "7723",
            declaredVolumeM3: "67.25",
            billReferences: ["mbl:NBOZ9FF56400"],
            upstreamReferences: prepared.upstreamReferences,
            cargoAllocations: [
              expect.objectContaining({
                productNumber: "331-015",
                quantity: "118",
                packageCount: "118",
                grossWeight: "1404.2",
                volume: "19.63",
              }),
              expect.objectContaining({
                sourceLineId: "BOM-002",
                productNumber: "842-327V80",
                quantity: "40",
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({ tenantId }),
    );
  });

  it("creates a v2 handoff without inventing missing Shipment facts", async () => {
    const preflightPackage = {
      execute: vi.fn().mockResolvedValue({
        packageId,
        sources: [],
        candidates: [
          {
            candidateRef: "HMMU4956442",
            decision: "review_required",
            containerNumber: "HMMU4956442",
            replenishmentOrderNumbers: ["26DSC01812"],
            billNumbers: ["NBOZ9FF56400D"],
            issues: [
              {
                code: "CARGO_DETAIL_INCOMPLETE",
                messageKey: "shipment_handoff_cargo_detail_incomplete",
              },
            ],
          },
        ],
        totals: {},
        traceId: "trace-preflight",
      }),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue({
        batch: { id: batchId, createdAt: new Date("2026-09-24T02:00:00Z") },
      }),
    };
    const acceptHandoff = {
      accept: vi.fn().mockResolvedValue({
        shipmentId: "70000000-0000-4000-8000-000000000003",
        issues: [],
      }),
    };
    const service = new AcceptPostDepartureSourceCandidateService(
      preflightPackage as never,
      repository as never,
      acceptHandoff as never,
    );

    const result = await service.execute(
      packageId,
      "HMMU4956442",
      {
        contractVersion: "post-departure-source-candidate-accept.v1",
        packageId,
        sources: [{ kind: "container", batchId }],
        candidateRef: "HMMU4956442",
        idempotencyKey: "accept:HMMU4956442:1",
      },
      { tenantId, actorId: "70000000-0000-4000-8000-000000000009" },
    );

    expect(acceptHandoff.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: "shipment-handoff.v2",
        shipment: { transportMode: "ocean" },
        billsOfLading: [],
        evidenceReferences: [],
        containers: [
          expect.objectContaining({
            referenceId: "HMMU4956442",
            containerNumber: "HMMU4956442",
            billReferences: [],
            upstreamReferences: [
              expect.objectContaining({
                referenceType: "stocking_order",
                sourceRecordId: "26DSC01812",
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({ tenantId }),
    );
    expect(result).toMatchObject({
      contractVersion: "post-departure-source-candidate-accept-result.v1",
      acceptedCandidateRefs: ["HMMU4956442"],
      handoff: {
        shipmentId: "70000000-0000-4000-8000-000000000003",
      },
    });
  });

  it("passes a selected existing Shipment as an explicit versioned target", async () => {
    const targetShipmentId = "70000000-0000-4000-8000-000000000010";
    const preflightPackage = {
      execute: vi.fn().mockResolvedValue({
        packageId,
        sources: [],
        candidates: [
          {
            candidateRef: "HMMU4956442",
            decision: "ready",
            containerNumber: "HMMU4956442",
            replenishmentOrderNumbers: [],
            billNumbers: [],
            issues: [],
            correction: {
              shipmentGrouping: {
                kind: "existing_shipment",
                shipmentId: targetShipmentId,
                expectedRelationshipVersion: 3,
              },
              originPort: { unlocode: "CNFZG", areaCode: "CN" },
              destinationPort: { unlocode: "USSAV", areaCode: "US" },
              departureProof: {
                kind: "actual_departure_time",
                occurredAt: "2026-09-24T02:00:00.000Z",
                sourceTimezone: "Asia/Shanghai",
                evidenceRef: "70000000-0000-4000-8000-000000000011",
              },
            },
            existingShipmentMatch: {
              shipmentId: "70000000-0000-4000-8000-000000000099",
              shipmentNumber: "SHP-SYSTEM-SUGGESTION",
              expectedRelationshipVersion: 8,
              matchedBy: "container_active_link",
            },
          },
        ],
        totals: {},
        traceId: "trace-preflight",
      }),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue({
        batch: { id: batchId, createdAt: new Date("2026-09-24T02:00:00Z") },
      }),
    };
    const acceptHandoff = {
      accept: vi.fn().mockResolvedValue({ shipmentId: targetShipmentId }),
    };
    const service = new AcceptPostDepartureSourceCandidateService(
      preflightPackage as never,
      repository as never,
      acceptHandoff as never,
    );

    await service.execute(
      packageId,
      "HMMU4956442",
      {
        contractVersion: "post-departure-source-candidate-accept.v1",
        packageId,
        sources: [{ kind: "container", batchId }],
        candidateRef: "HMMU4956442",
        idempotencyKey: "accept:HMMU4956442:existing",
      },
      { tenantId, actorId: "70000000-0000-4000-8000-000000000009" },
    );

    expect(acceptHandoff.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        shipment: expect.objectContaining({
          targetShipmentId,
          expectedRelationshipVersion: 3,
        }),
      }),
      expect.objectContaining({ tenantId }),
    );
  });

  it("uses the system Shipment match for a late source without manual correction", async () => {
    const targetShipmentId = "70000000-0000-4000-8000-000000000012";
    const preflightPackage = {
      execute: vi.fn().mockResolvedValue({
        packageId,
        sources: [],
        candidates: [
          {
            candidateRef: "HMMU4956442",
            decision: "ready",
            containerNumber: "HMMU4956442",
            replenishmentOrderNumbers: [],
            billNumbers: [],
            issues: [],
            existingShipmentMatch: {
              shipmentId: targetShipmentId,
              shipmentNumber: "SHP-26DSC01812",
              expectedRelationshipVersion: 5,
              matchedBy: "container_active_link",
            },
          },
        ],
        totals: {},
        traceId: "trace-preflight",
      }),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue({
        batch: { id: batchId, createdAt: new Date("2026-09-24T02:00:00Z") },
      }),
    };
    const acceptHandoff = {
      accept: vi.fn().mockResolvedValue({ shipmentId: targetShipmentId }),
    };
    const service = new AcceptPostDepartureSourceCandidateService(
      preflightPackage as never,
      repository as never,
      acceptHandoff as never,
    );

    await service.execute(
      packageId,
      "HMMU4956442",
      {
        contractVersion: "post-departure-source-candidate-accept.v1",
        packageId,
        sources: [{ kind: "warehouse", batchId }],
        candidateRef: "HMMU4956442",
        idempotencyKey: "accept:HMMU4956442:late-warehouse",
      },
      { tenantId, actorId: "70000000-0000-4000-8000-000000000009" },
    );

    expect(acceptHandoff.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        shipment: expect.objectContaining({
          targetShipmentId,
          expectedRelationshipVersion: 5,
        }),
      }),
      expect.objectContaining({ tenantId }),
    );
  });

  it("does not report a persisted Handoff rejection as an accepted candidate", async () => {
    const preflightPackage = {
      execute: vi.fn().mockResolvedValue({
        packageId,
        sources: [],
        candidates: [
          {
            candidateRef: "HMMU4956442",
            decision: "ready",
            containerNumber: "HMMU4956442",
            replenishmentOrderNumbers: [],
            billNumbers: [],
            issues: [],
          },
        ],
        totals: {},
        traceId: "trace-preflight",
      }),
    };
    const repository = {
      findById: vi.fn().mockResolvedValue({
        batch: { id: batchId, createdAt: new Date("2026-09-24T02:00:00Z") },
      }),
    };
    const acceptHandoff = {
      accept: vi.fn().mockResolvedValue({
        receptionState: "received",
        businessDecisionState: "rejected",
        commitState: "committed",
        duplicate: false,
        issues: [
          {
            code: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
            messageKey: "shipment_handoff_container_active_shipment_conflict",
          },
        ],
        traceId: "trace-rejected",
      }),
    };
    const service = new AcceptPostDepartureSourceCandidateService(
      preflightPackage as never,
      repository as never,
      acceptHandoff as never,
    );

    await expect(
      service.execute(
        packageId,
        "HMMU4956442",
        {
          contractVersion: "post-departure-source-candidate-accept.v1",
          packageId,
          sources: [{ kind: "container", batchId }],
          candidateRef: "HMMU4956442",
          idempotencyKey: "accept:HMMU4956442:rejected",
        },
        { tenantId, actorId: "70000000-0000-4000-8000-000000000009" },
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: "CONTAINER_ACTIVE_SHIPMENT_CONFLICT",
      }),
    });
  });
});
