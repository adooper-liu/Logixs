import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PostDepartureSourceCandidateCorrectionCommandV1 } from "@logix/contracts";
import type { AssertEvidenceRefsPort } from "../../document-records";
import type { ReferencePortDirectoryPort } from "../../master-data";
import {
  PostDepartureCorrectionIdempotencyConflictError,
  PostDepartureCorrectionVersionConflictError,
  type ImportRepository,
} from "../domain/import.repository";
import { CorrectPostDepartureSourceCandidateService } from "./correct-post-departure-source-candidate.service";

const PACKAGE_ID = "a".repeat(64);
const REVIEW_ID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID = "22222222-2222-4222-8222-222222222222";
const CANDIDATE_REF = "MSNU9762671";

describe("CorrectPostDepartureSourceCandidateService", () => {
  it("saves an empty progress version without resolving missing facts", async () => {
    const { service, repository, ports, evidence, shipments } = buildService();

    const result = await service.execute(
      PACKAGE_ID,
      REVIEW_ID,
      CANDIDATE_REF,
      {
        contractVersion: "post-departure-source-candidate-correction.v1",
        packageId: PACKAGE_ID,
        reviewId: REVIEW_ID,
        candidateRef: CANDIDATE_REF,
        expectedVersion: 0,
        shipmentGrouping: null,
        originPortCode: null,
        destinationPortCode: null,
        departureLocal: null,
        departureSourceTimezone: null,
        departureEvidenceRef: null,
        reasonCode: "source_progress_saved",
        idempotencyKey: "empty-progress-1",
      },
      "tenant-1",
      "operator-1",
    );

    expect(ports.findByUnlocodes).not.toHaveBeenCalled();
    expect(evidence.execute).not.toHaveBeenCalled();
    expect(shipments.execute).not.toHaveBeenCalled();
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentGroupingKind: null,
        originPortId: null,
        originUnlocode: null,
        destinationPortId: null,
        destinationUnlocode: null,
        departureLocal: null,
        departureOccurredAt: null,
        departureSourceTimezone: null,
        departureEvidenceId: null,
      }),
    );
    expect(result.candidate.correction).toMatchObject({ version: 1 });
    expect(result.candidate.correction).not.toHaveProperty("originPort");
    expect(result.candidate.correction).not.toHaveProperty("departureProof");
    expect(result.remainingIssues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "UNKNOWN_REFERENCE_CODE",
        "DEPARTURE_PROOF_REQUIRED",
        "CARGO_DETAIL_INCOMPLETE",
        "EXTERNAL_SHIPMENT_MATCH_REQUIRED",
      ]),
    );
  });

  it("saves a browser-local departure timestamp without evidence and keeps evidence pending", async () => {
    const { service, repository, evidence } = buildService();
    const input = command();
    delete input.departureProof;
    input.shipmentGrouping = { kind: "new_independent_shipment" };
    input.departureLocal = "2026-09-22T00:00:00.000";
    input.departureSourceTimezone = "Asia/Shanghai";
    input.departureEvidenceRef = null;

    const result = await service.execute(
      PACKAGE_ID,
      REVIEW_ID,
      CANDIDATE_REF,
      input,
      "tenant-1",
      "operator-1",
    );

    expect(evidence.execute).not.toHaveBeenCalled();
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        departureLocal: "2026-09-22T00:00:00.000",
        departureOccurredAt: new Date("2026-09-21T16:00:00.000Z"),
        departureSourceTimezone: "Asia/Shanghai",
        departureEvidenceId: null,
      }),
    );
    expect(result.remainingIssues.map(({ code }) => code)).toContain(
      "DEPARTURE_PROOF_REQUIRED",
    );
  });

  it("saves a controlled correction and keeps the SKU gap non-blocking", async () => {
    const { service, repository, ports, evidence } = buildService();

    const result = await service.execute(
      PACKAGE_ID,
      REVIEW_ID,
      CANDIDATE_REF,
      command(),
      "tenant-1",
      "operator-1",
    );

    expect(ports.findByUnlocodes).toHaveBeenCalledWith(["CNFZG", "USSAV"]);
    expect(evidence.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      subjectType: "domain_fact",
      subjectId: REVIEW_ID,
      evidenceIds: [EVIDENCE_ID],
    });
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        reviewId: REVIEW_ID,
        candidateRef: CANDIDATE_REF,
        expectedVersion: 0,
        shipmentNumber: "SHIP-2026-0001",
        originUnlocode: "CNFZG",
        destinationUnlocode: "USSAV",
        departureOccurredAt: new Date("2026-09-22T16:00:00.000Z"),
        departureSourceTimezone: "Asia/Shanghai",
        departureEvidenceId: EVIDENCE_ID,
        operatorId: "operator-1",
        reasonCode: "source_fact_confirmed",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(result).toMatchObject({
      contractVersion: "post-departure-source-candidate-correction-result.v1",
      status: "saved",
      version: 1,
      decision: "ready",
      candidate: {
        candidateRef: CANDIDATE_REF,
        decision: "ready",
        correction: {
          shipmentGrouping: {
            kind: "authorized_new_shipment",
            shipmentNumber: "SHIP-2026-0001",
          },
          originPort: { unlocode: "CNFZG", officialName: "Fuzhou" },
          destinationPort: { unlocode: "USSAV", officialName: "Savannah" },
          departureProof: {
            occurredAt: "2026-09-22T16:00:00.000Z",
            sourceTimezone: "Asia/Shanghai",
            evidenceRef: EVIDENCE_ID,
          },
        },
      },
    });
    expect(result.remainingIssues.map(({ code }) => code)).toEqual([
      "CARGO_DETAIL_INCOMPLETE",
    ]);
    expect(result.candidate.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "SOURCE_RANGE_METADATA_INVALID",
        "CARGO_DETAIL_INCOMPLETE",
      ]),
    );
    expect(result.candidate.issues.every(({ blocking }) => !blocking)).toBe(
      true,
    );
  });

  it("carries confirmed SKU lines into a later base-fact correction version", async () => {
    const { service, repository } = buildService();
    repository.listLatestPostDepartureSourceCandidateCorrections.mockResolvedValue(
      [
        {
          candidateRef: CANDIDATE_REF,
          cargoLines: [
            {
              id: "88888888-8888-4888-8888-888888888888",
              lineNumber: 1,
              sourceLineId: "line-1",
              replenishmentOrderNumber: "26DSA01884",
              productSkuId: "99999999-9999-4999-8999-999999999999",
              productNumber: "SKU-001",
              quantity: "10",
              quantityUnit: "piece",
              replenishmentOrderLineId: null,
            },
          ],
        },
      ],
    );
    const input = command();
    input.expectedVersion = 1;

    await service.execute(
      PACKAGE_ID,
      REVIEW_ID,
      CANDIDATE_REF,
      input,
      "tenant-1",
      "operator-1",
    );

    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        cargoLines: [
          expect.objectContaining({
            sourceLineId: "line-1",
            productNumber: "SKU-001",
            quantity: "10",
          }),
        ],
      }),
    );
  });

  it("persists an existing Shipment choice only after tenant and version validation", async () => {
    const { service, repository, shipments } = buildService();
    shipments.execute.mockResolvedValue({
      shipment: {
        id: "44444444-4444-4444-8444-444444444444",
        relationshipVersion: 3,
        currentLifecycleStatus: "departed",
      },
    });
    const input = command();
    input.shipmentGrouping = {
      kind: "existing_shipment",
      shipmentId: "44444444-4444-4444-8444-444444444444",
      expectedRelationshipVersion: 3,
    };

    await service.execute(
      PACKAGE_ID,
      REVIEW_ID,
      CANDIDATE_REF,
      input,
      "tenant-1",
      "operator-1",
    );

    expect(shipments.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      id: "44444444-4444-4444-8444-444444444444",
    });
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentGroupingKind: "existing_shipment",
        shipmentNumber: null,
        targetShipmentId: "44444444-4444-4444-8444-444444444444",
        targetRelationshipVersion: 3,
      }),
    );
  });

  it("persists a new independent Shipment without a user-supplied number", async () => {
    const { service, repository, shipments } = buildService();
    const input = command();
    input.shipmentGrouping = { kind: "new_independent_shipment" };

    await service.execute(
      PACKAGE_ID,
      REVIEW_ID,
      CANDIDATE_REF,
      input,
      "tenant-1",
      "operator-1",
    );

    expect(shipments.execute).not.toHaveBeenCalled();
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentGroupingKind: "new_independent_shipment",
        shipmentNumber: null,
        targetShipmentId: null,
        targetRelationshipVersion: null,
      }),
    );
  });

  it("rejects a package, review or candidate mismatch before writing", async () => {
    const { service, repository } = buildService();

    await expect(
      service.execute(
        "b".repeat(64),
        REVIEW_ID,
        CANDIDATE_REF,
        command(),
        "tenant-1",
        "operator-1",
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.execute(
        PACKAGE_ID,
        REVIEW_ID,
        "UNKNOWN",
        { ...command(), candidateRef: "UNKNOWN" },
        "tenant-1",
        "operator-1",
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).not.toHaveBeenCalled();
  });

  it("rejects a missing or inactive authoritative port", async () => {
    const { service, repository, ports } = buildService();
    ports.findByUnlocodes.mockResolvedValue([port("CNFZG", "Fuzhou")]);

    await expect(
      service.execute(
        PACKAGE_ID,
        REVIEW_ID,
        CANDIDATE_REF,
        command(),
        "tenant-1",
        "operator-1",
      ),
    ).rejects.toThrow("REFERENCE_PORT_NOT_ACTIVE");
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).not.toHaveBeenCalled();
  });

  it("rejects a non-IANA source timezone", async () => {
    const { service, repository } = buildService();
    const invalid = command();
    invalid.departureProof!.sourceTimezone = "GMT+8";

    await expect(
      service.execute(
        PACKAGE_ID,
        REVIEW_ID,
        CANDIDATE_REF,
        invalid,
        "tenant-1",
        "operator-1",
      ),
    ).rejects.toThrow("SOURCE_TIMEZONE_INVALID");
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).not.toHaveBeenCalled();
  });

  it("requires qualified evidence bound to this review", async () => {
    const { service, repository, evidence } = buildService();
    evidence.execute.mockRejectedValue(
      new BadRequestException("EVIDENCE_REQUIRED"),
    );

    await expect(
      service.execute(
        PACKAGE_ID,
        REVIEW_ID,
        CANDIDATE_REF,
        command(),
        "tenant-1",
        "operator-1",
      ),
    ).rejects.toThrow("EVIDENCE_REQUIRED");
    expect(
      repository.savePostDepartureSourceCandidateCorrection,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      new PostDepartureCorrectionIdempotencyConflictError(),
      "IDEMPOTENCY_PAYLOAD_CONFLICT",
    ],
    [
      new PostDepartureCorrectionVersionConflictError(),
      "POST_DEPARTURE_CORRECTION_VERSION_CONFLICT",
    ],
  ])(
    "maps repository conflicts to stable API errors",
    async (failure, code) => {
      const { service, repository } = buildService();
      repository.savePostDepartureSourceCandidateCorrection.mockRejectedValue(
        failure,
      );

      await expect(
        service.execute(
          PACKAGE_ID,
          REVIEW_ID,
          CANDIDATE_REF,
          command(),
          "tenant-1",
          "operator-1",
        ),
      ).rejects.toEqual(
        expect.objectContaining<Partial<ConflictException>>({
          message: code,
        }),
      );
    },
  );
});

function buildService() {
  const repository = {
    findPostDepartureSourcePackageReviewById: vi
      .fn()
      .mockResolvedValue(reviewRecord()),
    listLatestPostDepartureSourceCandidateCorrections: vi
      .fn()
      .mockResolvedValue([]),
    savePostDepartureSourceCandidateCorrection: vi
      .fn()
      .mockImplementation(async (input) => ({
        created: true,
        correction: {
          id: "33333333-3333-4333-8333-333333333333",
          ...input,
          version: 1,
          supersedesCorrectionId: null,
          createdAt: new Date("2026-09-24T01:00:00Z"),
        },
      })),
  };
  const ports = {
    search: vi.fn(),
    findByIds: vi.fn(),
    findByUnlocodes: vi
      .fn()
      .mockResolvedValue([port("CNFZG", "Fuzhou"), port("USSAV", "Savannah")]),
  };
  const evidence = { execute: vi.fn().mockResolvedValue(undefined) };
  const shipments = { execute: vi.fn() };
  return {
    service: new CorrectPostDepartureSourceCandidateService(
      repository as unknown as ImportRepository,
      ports as unknown as ReferencePortDirectoryPort,
      evidence as unknown as AssertEvidenceRefsPort,
      shipments as never,
    ),
    repository,
    ports,
    evidence,
    shipments,
  };
}

function reviewRecord() {
  return {
    id: REVIEW_ID,
    tenantId: "tenant-1",
    packageHash: PACKAGE_ID,
    contractVersion: "post-departure-source-package-review.v1" as const,
    decision: "review_required" as const,
    candidateCount: 1,
    reviewRequiredCount: 1,
    snapshot: {
      packageId: PACKAGE_ID,
      sources: [],
      candidates: [
        {
          candidateRef: CANDIDATE_REF,
          decision: "review_required" as const,
          containerNumber: CANDIDATE_REF,
          replenishmentOrderNumbers: ["26DSA01884"],
          billNumbers: ["1811F026PE36669R2"],
          issues: [
            issue("SOURCE_RANGE_METADATA_INVALID", "source_range"),
            issue("UNKNOWN_REFERENCE_CODE", "origin_port_code"),
            issue("UNKNOWN_REFERENCE_CODE", "destination_port_code"),
            issue("DEPARTURE_PROOF_REQUIRED", "departure_proof"),
            issue("CARGO_DETAIL_INCOMPLETE", "cargo_allocations"),
            issue("EXTERNAL_SHIPMENT_MATCH_REQUIRED", "shipment_grouping"),
          ],
        },
      ],
      totals: {
        containers: 1,
        bills: 1,
        replenishmentOrders: 1,
        ready: 0,
        reviewRequired: 1,
        rejected: 0,
      },
    },
    snapshotHash: "f".repeat(64),
    operatorId: "operator-0",
    traceId: "trace-review",
    createdAt: new Date("2026-09-23T08:00:00Z"),
  };
}

function issue(code: string, fieldCode: string) {
  return {
    code,
    messageKey: `shipment_handoff_${code.toLowerCase()}`,
    subjectRef: CANDIDATE_REF,
    fieldCodes: [fieldCode],
  };
}

function port(unlocode: string, officialName: string) {
  return {
    portId: `${unlocode}-id`,
    unlocode,
    officialName,
    areaCode: unlocode.slice(0, 2),
  };
}

function command(): PostDepartureSourceCandidateCorrectionCommandV1 {
  return {
    contractVersion: "post-departure-source-candidate-correction.v1" as const,
    packageId: PACKAGE_ID,
    reviewId: REVIEW_ID,
    candidateRef: CANDIDATE_REF,
    expectedVersion: 0,
    shipmentGrouping: {
      kind: "authorized_new_shipment" as const,
      shipmentNumber: "SHIP-2026-0001",
    },
    originPortCode: "CNFZG",
    destinationPortCode: "USSAV",
    departureProof: {
      kind: "actual_departure_time" as const,
      occurredAt: "2026-09-22T16:00:00.000Z",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: EVIDENCE_ID,
    },
    reasonCode: "source_fact_confirmed",
    idempotencyKey: "correction-1",
  };
}
