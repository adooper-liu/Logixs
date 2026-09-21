import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import {
  CARGO_READY_COMPLIANCE_REPOSITORY,
  CargoReadyComplianceConflictError,
} from "../domain/cargo-ready-compliance.repository";
import { DecideCargoReadyComplianceService } from "./decide-cargo-ready-compliance.service";

describe("DecideCargoReadyComplianceService", () => {
  it("normalizes and delegates an append-only decision", async () => {
    const repository = {
      replaceAssessment: vi.fn(),
      findCurrent: vi.fn(),
      decide: vi.fn().mockResolvedValue({ record: {}, duplicate: false }),
    };
    const assertEvidenceRefs = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        DecideCargoReadyComplianceService,
        { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
        { provide: CARGO_READY_COMPLIANCE_REPOSITORY, useValue: repository },
      ],
    }).compile();
    const result = await module
      .get(DecideCargoReadyComplianceService)
      .execute(command());

    expect(repository.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: command().assessmentId,
        decisionCode: "approved",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(assertEvidenceRefs.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      subjectType: "cargo_ready_compliance_assessment",
      subjectId: command().assessmentId,
      evidenceIds: command().evidenceRefs,
    });
    expect(result.duplicate).toBe(false);
  });

  it("maps decision conflicts without hiding the stable code", async () => {
    const repository = {
      replaceAssessment: vi.fn(),
      findCurrent: vi.fn(),
      decide: vi
        .fn()
        .mockRejectedValue(
          new CargoReadyComplianceConflictError(
            "CARGO_READY_FINDINGS_UNRESOLVED",
          ),
        ),
    };
    const module = await Test.createTestingModule({
      providers: [
        DecideCargoReadyComplianceService,
        {
          provide: ASSERT_EVIDENCE_REFS,
          useValue: { execute: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: CARGO_READY_COMPLIANCE_REPOSITORY, useValue: repository },
      ],
    }).compile();

    await expect(
      module.get(DecideCargoReadyComplianceService).execute(command()),
    ).rejects.toThrow(ConflictException);
  });
});

function command() {
  return {
    tenantId: "tenant-1",
    containerRecordId: "container-1",
    assessmentId: "11111111-1111-4111-8111-111111111111",
    expectedDecisionVersion: 0,
    decisionCode: "approved" as const,
    evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
    actorId: "reviewer-1",
    reasonCode: "REVIEW_APPROVED",
    idempotencyKey: "decision-1",
  };
}
