import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { GET_PRODUCT_COMPLIANCE_PROFILE } from "../../master-data";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { GET_CONTAINER_CARGO_COMPLIANCE_SCOPE } from "../../shipment-registry";
import { ASSERT_CONTAINER_TENANT } from "../../shipment-registry";
import { CARGO_READY_COMPLIANCE_REPOSITORY } from "../domain/cargo-ready-compliance.repository";
import { COMPLIANCE_RULE_REPOSITORY } from "../domain/compliance-rule.repository";
import { AssessCargoReadyComplianceService } from "./assess-cargo-ready-compliance.service";

describe("AssessCargoReadyComplianceService", () => {
  it("reads each unique loaded SKU through public ports and persists the snapshot", async () => {
    const scope = {
      containerRecordId: "container-1",
      allocationSetId: "11111111-1111-4111-8111-111111111111",
      allocationSetVersion: 1,
      items: [
        {
          replenishmentOrderLineId: "line-1",
          productSkuId: "22222222-2222-4222-8222-222222222222",
          productNumber: "SKU-1",
          allocatedQuantity: "1",
          quantityUnit: "piece",
        },
        {
          replenishmentOrderLineId: "line-2",
          productSkuId: "22222222-2222-4222-8222-222222222222",
          productNumber: "SKU-1",
          allocatedQuantity: "2",
          quantityUnit: "piece",
        },
      ],
    };
    const getScope = { execute: vi.fn().mockResolvedValue(scope) };
    const assertContainerTenant = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const assertEvidenceRefs = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const getProfile = { execute: vi.fn().mockResolvedValue(null) };
    const repository = {
      replaceAssessment: vi.fn().mockImplementation(async (input) => ({
        record: input,
        duplicate: false,
      })),
      decide: vi.fn(),
      findCurrent: vi.fn(),
    };
    const rules = { findPublishedForAssessment: vi.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({
      providers: [
        AssessCargoReadyComplianceService,
        { provide: ASSERT_CONTAINER_TENANT, useValue: assertContainerTenant },
        { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
        { provide: GET_CONTAINER_CARGO_COMPLIANCE_SCOPE, useValue: getScope },
        { provide: GET_PRODUCT_COMPLIANCE_PROFILE, useValue: getProfile },
        { provide: COMPLIANCE_RULE_REPOSITORY, useValue: rules },
        { provide: CARGO_READY_COMPLIANCE_REPOSITORY, useValue: repository },
      ],
    }).compile();

    const result = await module
      .get(AssessCargoReadyComplianceService)
      .execute(command());

    expect(getProfile.execute).toHaveBeenCalledTimes(1);
    expect(assertContainerTenant.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerId: "container-1",
    });
    expect(assertEvidenceRefs.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      subjectType: "container",
      subjectId: "container-1",
      evidenceIds: command().evidenceRefs,
    });
    expect(repository.replaceAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        allocationSetId: scope.allocationSetId,
        state: "action_required",
        findings: [
          expect.objectContaining({
            code: "PRODUCT_COMPLIANCE_PROFILE_MISSING",
          }),
          expect.objectContaining({
            code: "COMPLIANCE_RULE_COVERAGE_MISSING",
          }),
        ],
      }),
    );
    expect(result.duplicate).toBe(false);
  });

  it("rejects an invalid business date before reading the container", async () => {
    const assertContainerTenant = { execute: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AssessCargoReadyComplianceService,
        { provide: ASSERT_CONTAINER_TENANT, useValue: assertContainerTenant },
        {
          provide: ASSERT_EVIDENCE_REFS,
          useValue: { execute: vi.fn() },
        },
        {
          provide: GET_CONTAINER_CARGO_COMPLIANCE_SCOPE,
          useValue: { execute: vi.fn() },
        },
        {
          provide: GET_PRODUCT_COMPLIANCE_PROFILE,
          useValue: { execute: vi.fn() },
        },
        {
          provide: COMPLIANCE_RULE_REPOSITORY,
          useValue: { findPublishedForAssessment: vi.fn() },
        },
        {
          provide: CARGO_READY_COMPLIANCE_REPOSITORY,
          useValue: { replaceAssessment: vi.fn() },
        },
      ],
    }).compile();

    await expect(
      module
        .get(AssessCargoReadyComplianceService)
        .execute({ ...command(), assessmentDate: "2026-02-30" }),
    ).rejects.toThrow("VALIDATION_FORMAT: assessmentDate");
    expect(assertContainerTenant.execute).not.toHaveBeenCalled();
  });
});

function command() {
  return {
    tenantId: "tenant-1",
    containerRecordId: "container-1",
    jurisdictionCountryCode: "US",
    assessmentDate: "2026-09-20",
    expectedAssessmentVersion: 0,
    evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
    actorId: "operator-1",
    reasonCode: "INITIAL_REVIEW",
    idempotencyKey: "assessment-1",
  };
}
