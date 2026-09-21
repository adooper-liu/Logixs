import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSESS_CARGO_READY_COMPLIANCE } from "../../compliance-management";
import { PROJECT_EXTERNAL_WORK_ITEMS } from "../../work-execution";
import { AssessCargoReadyAndProjectService } from "./assess-cargo-ready-and-project.service";

describe("AssessCargoReadyAndProjectService", () => {
  it("projects each finding as a non-lifecycle work item", async () => {
    const assess = {
      execute: vi.fn().mockResolvedValue({
        record: {
          assessmentId: "assessment-1",
          version: 2,
          evidenceRefs: ["evidence-1"],
          findings: [
            {
              code: "PRODUCT_COMPLIANCE_PROFILE_MISSING",
              productSkuId: "sku-1",
              ruleVersionId: null,
              detail: "profile is missing",
            },
          ],
        },
        duplicate: false,
      }),
    };
    const project = {
      execute: vi.fn().mockResolvedValue({
        items: [],
        created: 1,
        cancelled: 2,
        duplicate: false,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AssessCargoReadyAndProjectService,
        { provide: ASSESS_CARGO_READY_COMPLIANCE, useValue: assess },
        { provide: PROJECT_EXTERNAL_WORK_ITEMS, useValue: project },
      ],
    }).compile();

    const result = await module
      .get(AssessCargoReadyAndProjectService)
      .execute(command());

    expect(project.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      sourceModule: "compliance-management",
      sourceType: "cargo_ready_compliance_assessment",
      sourceScopeId: "container:container-1:cargo_ready",
      sourceRecordId: "assessment-1",
      sourceVersion: 2,
      containerId: "container-1",
      items: [
        expect.objectContaining({
          taskDefinitionKey:
            "compliance-remediation:PRODUCT_COMPLIANCE_PROFILE_MISSING",
          assignedRoleCode: "review_supervisor",
          priority: "high",
        }),
      ],
    });
    expect(result.projection.cancelled).toBe(2);
  });

  it("projects an empty current set so old remediation is closed", async () => {
    const assess = {
      execute: vi.fn().mockResolvedValue({
        record: {
          assessmentId: "assessment-2",
          version: 3,
          evidenceRefs: ["evidence-2"],
          findings: [],
        },
        duplicate: false,
      }),
    };
    const project = {
      execute: vi.fn().mockResolvedValue({
        items: [],
        created: 0,
        cancelled: 1,
        duplicate: false,
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AssessCargoReadyAndProjectService,
        { provide: ASSESS_CARGO_READY_COMPLIANCE, useValue: assess },
        { provide: PROJECT_EXTERNAL_WORK_ITEMS, useValue: project },
      ],
    }).compile();

    await module.get(AssessCargoReadyAndProjectService).execute(command());

    expect(project.execute).toHaveBeenCalledWith(
      expect.objectContaining({ items: [], sourceVersion: 3 }),
    );
  });
});

function command() {
  return {
    tenantId: "tenant-1",
    containerRecordId: "container-1",
    jurisdictionCountryCode: "US",
    assessmentDate: "2026-09-20",
    expectedAssessmentVersion: 1,
    evidenceRefs: ["evidence-1"],
    actorId: "reviewer-1",
    reasonCode: "REVIEW",
    idempotencyKey: "assessment-2",
  };
}
