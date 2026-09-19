import type {
  CanonicalEventCode,
  CaptureSource,
  TimeKind,
} from "@logix/contracts";

export type AuthorityDecisionState =
  "accepted" | "review_required" | "configuration_error";

export interface LifecycleDateAuthorityDecision {
  state: AuthorityDecisionState;
  policyRef: string | null;
  reasonCode: string | null;
}

export interface LifecycleDateAuthorityInput {
  tenantId: string;
  eventCode: CanonicalEventCode;
  timeKind: TimeKind;
  occurredAt: Date;
  captureSource: CaptureSource;
  authoritySystem: string;
  jurisdiction?: string;
  direction?: string;
  locationRole?: string;
  transportMode?: string;
}

export interface LifecycleDateAuthorityEvidence {
  id: string;
  evidenceType: string;
  authorityLevel: string;
  sourceType: string;
  authoritySystem: string;
  verificationState: string;
  validity: string;
}

export interface SourceAuthorityPolicyRecord {
  id: string;
  policyId: string;
  policyVersion: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  tenantScope: string | null;
  eventCode: CanonicalEventCode;
  subjectType: "container";
  jurisdiction: string | null;
  direction: string | null;
  locationRole: string | null;
  transportMode: string | null;
  timeKind: TimeKind | null;
  allowedAuthoritySystems: string[];
  allowedSourceTypes: string[];
  minimumAuthorityLevel: string;
  requiredEvidenceTypes: string[];
  verificationRequirements: string[];
  corroborationRule: string | null;
  conflictAction: "accept" | "reject" | "review";
  manualCorrectionPolicyRef: string;
  sealingPolicyRef: string;
}

const AUTHORITY_RANK: Record<string, number> = {
  contextual: 0,
  operational: 1,
  corroborating: 2,
  authoritative: 3,
};

const ENFORCED_VERIFICATION_REQUIREMENTS = new Set([
  "tenant_match",
  "subject_match",
  "verified",
  "effective",
  "authority_system_match",
]);

export function decideLifecycleDateAuthority(
  input: LifecycleDateAuthorityInput,
  policies: readonly SourceAuthorityPolicyRecord[],
  evidence: readonly LifecycleDateAuthorityEvidence[],
): LifecycleDateAuthorityDecision {
  if (input.captureSource === "system_derived") {
    return review("SYSTEM_DERIVED_ACTUAL_NOT_AUTHORITATIVE");
  }

  const matching = policies
    .filter((policy) => policyMatches(policy, input))
    .map((policy) => ({ policy, specificity: specificity(policy) }));
  if (matching.length === 0) {
    return review("SOURCE_AUTHORITY_POLICY_NOT_FOUND");
  }

  const highestSpecificity = Math.max(
    ...matching.map((candidate) => candidate.specificity),
  );
  const mostSpecific = matching.filter(
    (candidate) => candidate.specificity === highestSpecificity,
  );
  if (mostSpecific.length !== 1) {
    return {
      state: "configuration_error",
      policyRef: null,
      reasonCode: "SOURCE_AUTHORITY_POLICY_AMBIGUOUS",
    };
  }

  const selected = mostSpecific[0]!.policy;
  const policyRef = `${selected.policyId}:v${selected.policyVersion}`;
  if (!selected.allowedAuthoritySystems.includes(input.authoritySystem)) {
    return review("SOURCE_AUTHORITY_SYSTEM_NOT_ALLOWED", policyRef);
  }
  if (selected.corroborationRule) {
    return review("SOURCE_AUTHORITY_CORROBORATION_REQUIRED", policyRef);
  }
  if (
    selected.verificationRequirements.some(
      (requirement) => !ENFORCED_VERIFICATION_REQUIREMENTS.has(requirement),
    )
  ) {
    return review("SOURCE_AUTHORITY_VERIFICATION_INCOMPLETE", policyRef);
  }

  const effectiveEvidence = evidence.filter(
    (item) =>
      item.verificationState === "verified" && item.validity === "effective",
  );
  const evidenceTypes = new Set(
    effectiveEvidence.map((item) => item.evidenceType),
  );
  if (
    selected.requiredEvidenceTypes.some(
      (evidenceType) => !evidenceTypes.has(evidenceType),
    )
  ) {
    return review("SOURCE_AUTHORITY_EVIDENCE_TYPE_REQUIRED", policyRef);
  }

  const minimumRank = AUTHORITY_RANK[selected.minimumAuthorityLevel];
  const hasQualifiedAuthority = effectiveEvidence.some(
    (item) =>
      item.authoritySystem === input.authoritySystem &&
      selected.allowedSourceTypes.includes(item.sourceType) &&
      minimumRank !== undefined &&
      (AUTHORITY_RANK[item.authorityLevel] ?? -1) >= minimumRank,
  );
  if (!hasQualifiedAuthority) {
    return review("SOURCE_AUTHORITY_EVIDENCE_NOT_QUALIFIED", policyRef);
  }

  return { state: "accepted", policyRef, reasonCode: null };
}

function policyMatches(
  policy: SourceAuthorityPolicyRecord,
  input: LifecycleDateAuthorityInput,
): boolean {
  return (
    policy.eventCode === input.eventCode &&
    policy.subjectType === "container" &&
    (!policy.tenantScope || policy.tenantScope === input.tenantId) &&
    policy.effectiveFrom <= input.occurredAt &&
    (!policy.effectiveTo || input.occurredAt < policy.effectiveTo) &&
    (!policy.timeKind || policy.timeKind === input.timeKind) &&
    optionalScopeMatches(policy.jurisdiction, input.jurisdiction) &&
    optionalScopeMatches(policy.direction, input.direction) &&
    optionalScopeMatches(policy.locationRole, input.locationRole) &&
    optionalScopeMatches(policy.transportMode, input.transportMode)
  );
}

function optionalScopeMatches(
  policyValue: string | null,
  factValue: string | undefined,
): boolean {
  return policyValue === null || policyValue === factValue;
}

function specificity(policy: SourceAuthorityPolicyRecord): number {
  return [
    policy.tenantScope,
    policy.timeKind,
    policy.jurisdiction,
    policy.direction,
    policy.locationRole,
    policy.transportMode,
  ].filter((value) => value !== null).length;
}

function review(
  reasonCode: string,
  policyRef: string | null = null,
): LifecycleDateAuthorityDecision {
  return { state: "review_required", policyRef, reasonCode };
}
