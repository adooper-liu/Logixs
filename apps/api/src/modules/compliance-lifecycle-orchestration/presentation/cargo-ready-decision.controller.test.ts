import { describe, expect, it, vi } from "vitest";
import { CargoReadyDecisionController } from "./cargo-ready-decision.controller";

describe("CargoReadyDecisionController", () => {
  it("takes tenant and reviewer identity from authentication and returns replay status", async () => {
    const decide = {
      execute: vi.fn().mockResolvedValue({
        record: {
          assessmentId: "assessment-1",
          version: 1,
          state: "decided",
        },
        duplicate: false,
        replay: {
          status: "completed",
          reasonCode: "REPLAY_COMPLETED",
          claimed: 1,
          applied: 1,
          pending: 0,
          rejected: 0,
        },
      }),
    };
    const controller = new CargoReadyDecisionController(
      decide as never,
      { execute: vi.fn() } as never,
    );

    const response = await controller.createDecision(
      "container-1",
      {
        assessmentId: "11111111-1111-4111-8111-111111111111",
        expectedDecisionVersion: 0,
        decisionCode: "approved",
        evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
        reasonCode: "REVIEW_APPROVED",
        idempotencyKey: "decision-1",
      },
      { identity: { tenantId: "tenant-1", actorId: "reviewer-1" } },
    );

    expect(decide.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "reviewer-1",
        containerRecordId: "container-1",
      }),
    );
    expect(response.replay.status).toBe("completed");
  });

  it("takes identity from authentication and reports remediation projection", async () => {
    const assess = {
      execute: vi.fn().mockResolvedValue({
        record: {
          assessmentId: "assessment-1",
          version: 1,
          state: "action_required",
        },
        duplicate: false,
        projection: { created: 2, cancelled: 0 },
      }),
    };
    const controller = new CargoReadyDecisionController(
      { execute: vi.fn() } as never,
      assess as never,
    );

    const response = await controller.createAssessment(
      "container-1",
      {
        jurisdictionCountryCode: "US",
        assessmentDate: "2026-09-20",
        expectedAssessmentVersion: 0,
        evidenceRefs: ["11111111-1111-4111-8111-111111111111"],
        reasonCode: "INITIAL_REVIEW",
        idempotencyKey: "assessment-1",
      },
      { identity: { tenantId: "tenant-1", actorId: "reviewer-1" } },
    );

    expect(assess.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "reviewer-1",
        containerRecordId: "container-1",
      }),
    );
    expect(response.remediationCreated).toBe(2);
  });
});
