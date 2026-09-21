import { describe, expect, it, vi } from "vitest";
import { CargoReadyComplianceController } from "./cargo-ready-compliance.controller";

describe("CargoReadyComplianceController", () => {
  it("takes tenant identity from the authenticated request", async () => {
    const getCurrent = {
      execute: vi.fn().mockResolvedValue({
        assessmentId: "assessment-1",
        containerRecordId: "container-1",
        version: 1,
        state: "ready_for_decision",
        jurisdictionCountryCode: "US",
        assessmentDate: "2026-09-20",
        allocationSetId: null,
        allocationSetVersion: null,
        items: [],
        findings: [],
        ruleSnapshots: [],
        evidenceRefs: [],
        actorId: "reviewer-1",
        reasonCode: "INITIAL_REVIEW",
        currentDecision: null,
        createdAt: "2026-09-20T00:00:00.000Z",
      }),
    };
    const controller = new CargoReadyComplianceController(getCurrent as never);

    await controller.get("container-1", { identity: { tenantId: "tenant-1" } });

    expect(getCurrent.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerRecordId: "container-1",
    });
  });
});
