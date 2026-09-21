import { describe, expect, it } from "vitest";
import {
  assessmentMatchesCurrentInputs,
  buildCargoReadyAssessment,
  normalizeCargoReadyDecision,
} from "./cargo-ready-compliance";

interface ProfileFixture {
  profileId: string;
  version: number;
  verificationState: string;
  battery: { presenceState: string };
  refrigerant: { presenceState: string };
  dangerousGoods: { classificationState: string };
  inspectionRequirements: Array<{ requirementState: string }>;
  certificates: Array<{
    certificateType: string;
    coverageScope: "global" | "countries";
    coveredCountryCodes: string[];
    validFrom: string;
    validUntil: string | null;
    verificationState: string;
  }>;
}

const scope = {
  containerRecordId: "container-1",
  allocationSetId: "11111111-1111-4111-8111-111111111111",
  allocationSetVersion: 1,
  items: [
    {
      replenishmentOrderLineId: "line-1",
      productSkuId: "22222222-2222-4222-8222-222222222222",
      productNumber: "SKU-1",
      allocatedQuantity: "10",
      quantityUnit: "piece",
    },
  ],
};

describe("cargo-ready compliance", () => {
  it("marks verified and determined SKU facts ready for a human decision", () => {
    const assessment = buildCargoReadyAssessment({
      command: command(),
      scope,
      profiles: new Map([[scope.items[0]!.productSkuId, profile()]]),
      ruleEvaluation: { ruleSnapshots: [ruleSnapshot()], findings: [] },
    });

    expect(assessment.state).toBe("ready_for_decision");
    expect(assessment.findings).toEqual([]);
    expect(assessment.items[0]).toMatchObject({
      complianceProfileId: profile().profileId,
      complianceProfileVersion: 1,
    });
  });

  it("does not turn missing or unknown compliance facts into defaults", () => {
    const missing = buildCargoReadyAssessment({
      command: command(),
      scope,
      profiles: new Map(),
      ruleEvaluation: { ruleSnapshots: [], findings: [] },
    });
    expect(missing.findings.map((finding) => finding.code)).toEqual([
      "PRODUCT_COMPLIANCE_PROFILE_MISSING",
    ]);

    const unknown = buildCargoReadyAssessment({
      command: command(),
      scope,
      profiles: new Map([
        [
          scope.items[0]!.productSkuId,
          profile({
            battery: { presenceState: "unknown" },
          }),
        ],
      ]),
      ruleEvaluation: { ruleSnapshots: [], findings: [] },
    });
    expect(unknown.state).toBe("action_required");
    expect(unknown.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "BATTERY_CLASSIFICATION_UNDETERMINED",
        }),
      ]),
    );
  });

  it("invalidates an assessment when the profile version changes", () => {
    const assessment = buildCargoReadyAssessment({
      command: command(),
      scope,
      profiles: new Map([[scope.items[0]!.productSkuId, profile()]]),
      ruleEvaluation: { ruleSnapshots: [ruleSnapshot()], findings: [] },
    });

    expect(
      assessmentMatchesCurrentInputs({
        allocationSetId: assessment.allocationSetId,
        items: assessment.items,
        ruleSnapshots: assessment.ruleSnapshots,
        scope,
        profiles: new Map([
          [scope.items[0]!.productSkuId, profile({ version: 2 })],
        ]),
        currentRuleSnapshots: [ruleSnapshot()],
      }),
    ).toBe(false);
  });

  it("invalidates an assessment when the applicable rule version changes", () => {
    const assessment = buildCargoReadyAssessment({
      command: command(),
      scope,
      profiles: new Map([[scope.items[0]!.productSkuId, profile()]]),
      ruleEvaluation: { ruleSnapshots: [ruleSnapshot()], findings: [] },
    });

    expect(
      assessmentMatchesCurrentInputs({
        allocationSetId: assessment.allocationSetId,
        items: assessment.items,
        ruleSnapshots: assessment.ruleSnapshots,
        scope,
        profiles: new Map([[scope.items[0]!.productSkuId, profile()]]),
        currentRuleSnapshots: [{ ...ruleSnapshot(), version: 2 }],
      }),
    ).toBe(false);
  });

  it("requires explicit condition references only for conditional approval", () => {
    expect(() =>
      normalizeCargoReadyDecision({
        tenantId: "tenant-1",
        containerRecordId: "container-1",
        assessmentId: "11111111-1111-4111-8111-111111111111",
        expectedDecisionVersion: 0,
        decisionCode: "approved_with_conditions",
        evidenceRefs: ["evidence-1"],
        actorId: "reviewer-1",
        reasonCode: "CONDITIONAL_REVIEW",
        idempotencyKey: "decision-1",
      }),
    ).toThrow("VALIDATION_CONFLICT: conditionRefs");
    expect(
      normalizeCargoReadyDecision({
        tenantId: "tenant-1",
        containerRecordId: "container-1",
        assessmentId: "11111111-1111-4111-8111-111111111111",
        expectedDecisionVersion: 0,
        decisionCode: "approved_with_conditions",
        conditionRefs: ["obligation-1"],
        evidenceRefs: ["evidence-1"],
        actorId: "reviewer-1",
        reasonCode: "CONDITIONAL_REVIEW",
        idempotencyKey: "decision-1",
      }).conditionRefs,
    ).toEqual(["obligation-1"]);
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

function profile(overrides: Partial<ProfileFixture> = {}): ProfileFixture {
  return {
    profileId: "44444444-4444-4444-8444-444444444444",
    version: 1,
    battery: { presenceState: "absent" },
    refrigerant: { presenceState: "absent" },
    dangerousGoods: { classificationState: "not_regulated" },
    inspectionRequirements: [],
    certificates: [],
    verificationState: "verified",
    ...overrides,
  };
}

function ruleSnapshot() {
  return {
    ruleVersionId: "55555555-5555-4555-8555-555555555555",
    ruleCode: "US_BASELINE",
    version: 1,
    productSkuId: scope.items[0]!.productSkuId,
    requirementLayer: "law_regulation",
    requiredCertificateTypes: [],
    blockingNodeCodes: ["cargo_ready"],
    severity: "high",
    officialSourceUrl: "https://example.gov/rule",
    legalCitation: "Example 1",
  };
}
