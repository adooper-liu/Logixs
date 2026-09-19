import { describe, expect, it } from "vitest";
import {
  decideLifecycleDateAuthority,
  type LifecycleDateAuthorityEvidence,
  type SourceAuthorityPolicyRecord,
} from "./source-authority-decision";

const input = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  eventCode: "departed" as const,
  timeKind: "actual" as const,
  occurredAt: new Date("2026-09-18T00:00:00Z"),
  captureSource: "external_evidence" as const,
  authoritySystem: "carrier-a",
};

function policy(
  overrides: Partial<SourceAuthorityPolicyRecord> = {},
): SourceAuthorityPolicyRecord {
  return {
    id: "policy-row-1",
    policyId: "22222222-2222-4222-8222-222222222222",
    policyVersion: 1,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    tenantScope: null,
    eventCode: "departed",
    subjectType: "container",
    jurisdiction: null,
    direction: null,
    locationRole: null,
    transportMode: null,
    timeKind: "actual",
    allowedAuthoritySystems: ["carrier-a"],
    allowedSourceTypes: ["system"],
    minimumAuthorityLevel: "authoritative",
    requiredEvidenceTypes: ["api_response"],
    verificationRequirements: ["subject_match"],
    corroborationRule: null,
    conflictAction: "review",
    manualCorrectionPolicyRef: "manual-correction-v1",
    sealingPolicyRef: "actual-node-fact-v1",
    ...overrides,
  };
}

function evidence(
  overrides: Partial<LifecycleDateAuthorityEvidence> = {},
): LifecycleDateAuthorityEvidence {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    evidenceType: "api_response",
    authorityLevel: "authoritative",
    sourceType: "system",
    authoritySystem: "carrier-a",
    verificationState: "verified",
    validity: "effective",
    ...overrides,
  };
}

describe("decideLifecycleDateAuthority", () => {
  it("唯一最具体策略及合格证据通过时返回策略版本引用", () => {
    expect(
      decideLifecycleDateAuthority(input, [policy()], [evidence()]),
    ).toEqual({
      state: "accepted",
      policyRef: "22222222-2222-4222-8222-222222222222:v1",
      reasonCode: null,
    });
  });

  it("无策略时进入复核", () => {
    expect(decideLifecycleDateAuthority(input, [], [evidence()])).toEqual({
      state: "review_required",
      policyRef: null,
      reasonCode: "SOURCE_AUTHORITY_POLICY_NOT_FOUND",
    });
  });

  it("同等具体策略重叠时报告配置错误，不任选", () => {
    const second = policy({
      id: "policy-row-2",
      policyId: "44444444-4444-4444-8444-444444444444",
    });

    expect(
      decideLifecycleDateAuthority(input, [policy(), second], [evidence()]),
    ).toEqual({
      state: "configuration_error",
      policyRef: null,
      reasonCode: "SOURCE_AUTHORITY_POLICY_AMBIGUOUS",
    });
  });

  it("租户范围策略比全局策略更具体", () => {
    const tenantPolicy = policy({
      id: "policy-row-tenant",
      policyId: "55555555-5555-4555-8555-555555555555",
      tenantScope: input.tenantId,
    });

    expect(
      decideLifecycleDateAuthority(
        input,
        [policy(), tenantPolicy],
        [evidence()],
      ),
    ).toMatchObject({
      state: "accepted",
      policyRef: "55555555-5555-4555-8555-555555555555:v1",
    });
  });

  it("system_derived 不能证明 actual", () => {
    expect(
      decideLifecycleDateAuthority(
        { ...input, captureSource: "system_derived" },
        [policy()],
        [evidence()],
      ),
    ).toEqual({
      state: "review_required",
      policyRef: null,
      reasonCode: "SYSTEM_DERIVED_ACTUAL_NOT_AUTHORITATIVE",
    });
  });

  it("证据来源类型、等级或必需类型不满足时进入复核", () => {
    expect(
      decideLifecycleDateAuthority(
        input,
        [policy()],
        [evidence({ sourceType: "device" })],
      ),
    ).toMatchObject({
      state: "review_required",
      reasonCode: "SOURCE_AUTHORITY_EVIDENCE_NOT_QUALIFIED",
    });
  });
});
