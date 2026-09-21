import { describe, expect, it } from "vitest";
import {
  evaluateComplianceRuleApplicability,
  normalizeComplianceRuleVersion,
  type PublishedComplianceRuleVersionRecord,
} from "./compliance-rule";
import type {
  CargoReadyAssessmentItemSnapshot,
  ComplianceProfileInput,
} from "./cargo-ready-compliance";

const productSkuId = "22222222-2222-4222-8222-222222222222";
const ruleVersionId = "33333333-3333-4333-8333-333333333333";

describe("compliance rule", () => {
  it("normalizes an auditable published rule without implicit scope", () => {
    const normalized = normalizeComplianceRuleVersion(command());

    expect(normalized).toMatchObject({
      ruleCode: "US_CARGO_READY_BASELINE",
      jurisdictionCountryCode: "US",
      appliesToAllSkus: true,
      productSkuIds: [],
      batteryRequirement: "any",
      blockingNodeCodes: ["cargo_ready"],
      approvedBy: "reviewer-1",
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects conflicting SKU scope and non-HTTPS official sources", () => {
    expect(() =>
      normalizeComplianceRuleVersion({
        ...command(),
        productSkuIds: [productSkuId],
      }),
    ).toThrow("VALIDATION_CONFLICT: productSkuIds");
    expect(() =>
      normalizeComplianceRuleVersion({
        ...command(),
        officialSourceUrl: "http://example.gov/rule",
      }),
    ).toThrow("VALIDATION_FORMAT: officialSourceUrl");
  });

  it("requires explicit rule coverage instead of treating an empty catalog as approval", () => {
    const result = evaluateComplianceRuleApplicability({
      jurisdictionCountryCode: "US",
      assessmentDate: "2026-09-20",
      items: [item()],
      profiles: new Map([[productSkuId, profile()]]),
      rules: [],
    });

    expect(result.ruleSnapshots).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({ code: "COMPLIANCE_RULE_COVERAGE_MISSING" }),
    ]);
  });

  it("matches typed predicates and verifies certificate type, date, country and state", () => {
    const applicable = evaluateComplianceRuleApplicability({
      jurisdictionCountryCode: "US",
      assessmentDate: "2026-09-20",
      items: [item()],
      profiles: new Map([[productSkuId, profile({ withCertificate: true })]]),
      rules: [rule({ requiredCertificateTypes: ["un38_3"] })],
    });
    expect(applicable.findings).toEqual([]);
    expect(applicable.ruleSnapshots).toEqual([
      expect.objectContaining({ ruleVersionId, productSkuId }),
    ]);

    const missing = evaluateComplianceRuleApplicability({
      jurisdictionCountryCode: "US",
      assessmentDate: "2026-09-20",
      items: [item()],
      profiles: new Map([[productSkuId, profile()]]),
      rules: [rule({ requiredCertificateTypes: ["un38_3"] })],
    });
    expect(missing.findings).toEqual([
      expect.objectContaining({
        code: "REQUIRED_CERTIFICATE_MISSING_OR_INVALID",
        ruleVersionId,
      }),
    ]);
  });

  it("records an undetermined applicability instead of silently skipping a rule", () => {
    const result = evaluateComplianceRuleApplicability({
      jurisdictionCountryCode: "US",
      assessmentDate: "2026-09-20",
      items: [item()],
      profiles: new Map([
        [productSkuId, profile({ batteryPresence: "unknown" })],
      ]),
      rules: [rule({ batteryRequirement: "present" })],
    });

    expect(result.ruleSnapshots).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        code: "RULE_APPLICABILITY_UNDETERMINED",
        ruleVersionId,
      }),
    ]);
  });
});

function command() {
  return {
    tenantId: "tenant-1",
    ruleCode: "us_cargo_ready_baseline",
    expectedVersion: 0,
    requirementLayer: "law_regulation" as const,
    jurisdictionCountryCode: "us",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    appliesToAllSkus: true,
    productSkuIds: [],
    requiredCertificateTypes: [],
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

function item(): CargoReadyAssessmentItemSnapshot {
  return {
    replenishmentOrderLineId: "line-1",
    productSkuId,
    productNumber: "SKU-1",
    complianceProfileId: "55555555-5555-4555-8555-555555555555",
    complianceProfileVersion: 1,
  };
}

function profile(
  input: {
    withCertificate?: boolean;
    batteryPresence?: string;
  } = {},
): ComplianceProfileInput {
  return {
    profileId: "55555555-5555-4555-8555-555555555555",
    version: 1,
    verificationState: "verified",
    battery: { presenceState: input.batteryPresence ?? "present" },
    refrigerant: { presenceState: "absent" },
    dangerousGoods: { classificationState: "not_regulated" },
    inspectionRequirements: [],
    certificates: input.withCertificate
      ? [
          {
            certificateType: "un38_3",
            coverageScope: "countries",
            coveredCountryCodes: ["US"],
            validFrom: "2026-01-01",
            validUntil: "2026-12-31",
            verificationState: "verified",
          },
        ]
      : [],
  };
}

function rule(
  overrides: Partial<PublishedComplianceRuleVersionRecord> = {},
): PublishedComplianceRuleVersionRecord {
  return {
    ruleVersionId,
    ruleCode: "US_CARGO_READY_BASELINE",
    version: 1,
    requirementLayer: "law_regulation",
    jurisdictionCountryCode: "US",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    appliesToAllSkus: true,
    productSkuIds: [],
    batteryRequirement: "any",
    refrigerantRequirement: "any",
    dangerousGoodsRequirement: "any",
    requiredCertificateTypes: [],
    blockingNodeCodes: ["cargo_ready"],
    severity: "high",
    officialSourceUrl: "https://example.gov/rule",
    legalCitation: "Example Act 1",
    owner: "global-compliance",
    approvedBy: "reviewer-1",
    approvedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}
