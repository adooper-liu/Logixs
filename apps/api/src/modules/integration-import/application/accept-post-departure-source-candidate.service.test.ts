import { describe, expect, it, vi } from "vitest";
import { AcceptPostDepartureSourceCandidateService } from "./accept-post-departure-source-candidate.service";

const packageId = "a".repeat(64);
const tenantId = "demo-real-sample-20260921";
const batchId = "70000000-0000-4000-8000-000000000002";

describe("AcceptPostDepartureSourceCandidateService", () => {
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
