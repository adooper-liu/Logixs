import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_EVIDENCE_REFS } from "../../document-records";
import { GET_PRODUCT_SKU } from "../../master-data";
import {
  COMPLIANCE_RULE_REPOSITORY,
  ComplianceRuleConflictError,
} from "../domain/compliance-rule.repository";
import { PublishComplianceRuleVersionService } from "./publish-compliance-rule-version.service";

describe("PublishComplianceRuleVersionService", () => {
  it("verifies evidence and scoped SKUs before publishing", async () => {
    const repository = {
      publish: vi.fn().mockImplementation(async (input) => ({
        record: input,
        duplicate: false,
      })),
    };
    const assertEvidenceRefs = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const getProductSku = {
      execute: vi.fn().mockResolvedValue({ productSkuId: skuId }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PublishComplianceRuleVersionService,
        { provide: COMPLIANCE_RULE_REPOSITORY, useValue: repository },
        { provide: ASSERT_EVIDENCE_REFS, useValue: assertEvidenceRefs },
        { provide: GET_PRODUCT_SKU, useValue: getProductSku },
      ],
    }).compile();

    await module.get(PublishComplianceRuleVersionService).execute(command());

    expect(assertEvidenceRefs.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      subjectType: "compliance_rule",
      subjectId: "US_SKU_RULE",
      evidenceIds: command().evidenceRefs,
    });
    expect(getProductSku.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      productSkuId: skuId,
    });
    expect(repository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleCode: "US_SKU_RULE",
        productSkuIds: [skuId],
        approvedBy: "reviewer-1",
      }),
    );
  });

  it("maps optimistic publication conflicts without hiding the reason", async () => {
    const module = await Test.createTestingModule({
      providers: [
        PublishComplianceRuleVersionService,
        {
          provide: COMPLIANCE_RULE_REPOSITORY,
          useValue: {
            publish: vi
              .fn()
              .mockRejectedValue(
                new ComplianceRuleConflictError(
                  "COMPLIANCE_RULE_VERSION_CONFLICT",
                ),
              ),
          },
        },
        {
          provide: ASSERT_EVIDENCE_REFS,
          useValue: { execute: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: GET_PRODUCT_SKU,
          useValue: {
            execute: vi.fn().mockResolvedValue({ productSkuId: skuId }),
          },
        },
      ],
    }).compile();

    await expect(
      module.get(PublishComplianceRuleVersionService).execute(command()),
    ).rejects.toThrow(ConflictException);
  });
});

const skuId = "22222222-2222-4222-8222-222222222222";

function command() {
  return {
    tenantId: "tenant-1",
    ruleCode: "US_SKU_RULE",
    expectedVersion: 0,
    requirementLayer: "law_regulation" as const,
    jurisdictionCountryCode: "US",
    effectiveFrom: "2026-01-01",
    appliesToAllSkus: false,
    productSkuIds: [skuId],
    blockingNodeCodes: ["cargo_ready"],
    severity: "high" as const,
    officialSourceUrl: "https://example.gov/rule",
    legalCitation: "Example Act 1",
    owner: "global-compliance",
    evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
    actorId: "reviewer-1",
    reasonCode: "INITIAL_PUBLICATION",
    idempotencyKey: "rule-publication-1",
  };
}
