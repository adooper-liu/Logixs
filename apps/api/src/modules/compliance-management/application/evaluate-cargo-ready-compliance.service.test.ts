import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { GET_PRODUCT_COMPLIANCE_PROFILE } from "../../master-data";
import { GET_CONTAINER_CARGO_COMPLIANCE_SCOPE } from "../../shipment-registry";
import { CARGO_READY_COMPLIANCE_REPOSITORY } from "../domain/cargo-ready-compliance.repository";
import { COMPLIANCE_RULE_REPOSITORY } from "../domain/compliance-rule.repository";
import { EvaluateCargoReadyComplianceService } from "./evaluate-cargo-ready-compliance.service";

describe("EvaluateCargoReadyComplianceService", () => {
  it("rejects a previously approved decision after its input profile changes", async () => {
    const assessment = currentAssessment();
    const getScope = { execute: vi.fn().mockResolvedValue(scope()) };
    const getProfile = {
      execute: vi.fn().mockResolvedValue({
        profileId: "44444444-4444-4444-8444-444444444444",
        version: 2,
      }),
    };
    const repository = {
      replaceAssessment: vi.fn(),
      decide: vi.fn(),
      findCurrent: vi.fn().mockResolvedValue(assessment),
    };
    const module = await Test.createTestingModule({
      providers: [
        EvaluateCargoReadyComplianceService,
        { provide: GET_CONTAINER_CARGO_COMPLIANCE_SCOPE, useValue: getScope },
        { provide: GET_PRODUCT_COMPLIANCE_PROFILE, useValue: getProfile },
        {
          provide: COMPLIANCE_RULE_REPOSITORY,
          useValue: {
            findPublishedForAssessment: vi.fn().mockResolvedValue([]),
          },
        },
        { provide: CARGO_READY_COMPLIANCE_REPOSITORY, useValue: repository },
      ],
    }).compile();

    await expect(
      module.get(EvaluateCargoReadyComplianceService).execute({
        tenantId: "tenant-1",
        containerRecordId: "container-1",
      }),
    ).resolves.toMatchObject({
      approved: false,
      reasonCode: "CARGO_READY_COMPLIANCE_INPUTS_CHANGED",
    });
  });

  it("does not read downstream facts when no assessment exists", async () => {
    const getScope = { execute: vi.fn() };
    const getProfile = { execute: vi.fn() };
    const repository = {
      replaceAssessment: vi.fn(),
      decide: vi.fn(),
      findCurrent: vi.fn().mockResolvedValue(null),
    };
    const module = await Test.createTestingModule({
      providers: [
        EvaluateCargoReadyComplianceService,
        { provide: GET_CONTAINER_CARGO_COMPLIANCE_SCOPE, useValue: getScope },
        { provide: GET_PRODUCT_COMPLIANCE_PROFILE, useValue: getProfile },
        {
          provide: COMPLIANCE_RULE_REPOSITORY,
          useValue: { findPublishedForAssessment: vi.fn() },
        },
        { provide: CARGO_READY_COMPLIANCE_REPOSITORY, useValue: repository },
      ],
    }).compile();

    await expect(
      module.get(EvaluateCargoReadyComplianceService).execute({
        tenantId: "tenant-1",
        containerRecordId: "container-1",
      }),
    ).resolves.toMatchObject({
      approved: false,
      reasonCode: "CARGO_READY_COMPLIANCE_NOT_ASSESSED",
    });
    expect(getScope.execute).not.toHaveBeenCalled();
  });
});

function scope() {
  return {
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
    ],
    ruleSnapshots: [],
  };
}

function currentAssessment() {
  return {
    assessmentId: "33333333-3333-4333-8333-333333333333",
    tenantId: "tenant-1",
    containerRecordId: "container-1",
    version: 1,
    state: "decided" as const,
    jurisdictionCountryCode: "US",
    assessmentDate: "2026-09-20",
    allocationSetId: scope().allocationSetId,
    allocationSetVersion: 1,
    items: [
      {
        replenishmentOrderLineId: "line-1",
        productSkuId: scope().items[0]!.productSkuId,
        productNumber: "SKU-1",
        complianceProfileId: "44444444-4444-4444-8444-444444444444",
        complianceProfileVersion: 1,
      },
    ],
    findings: [],
    evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
    actorId: "reviewer-1",
    reasonCode: "REVIEW_APPROVED",
    currentDecision: {
      decisionId: "66666666-6666-4666-8666-666666666666",
      version: 1,
      decisionCode: "approved" as const,
      conditionRefs: [],
      evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
      actorId: "reviewer-1",
      reasonCode: "REVIEW_APPROVED",
      decidedAt: "2026-09-20T00:00:00.000Z",
    },
    createdAt: "2026-09-20T00:00:00.000Z",
  };
}
