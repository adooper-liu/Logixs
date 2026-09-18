import type { TrackingEyesNormalizationResult } from "./trackingeyes-event-candidate";

export type TrackingEyesAuthorityDecisionState = "review_required" | "rejected";

export interface TrackingEyesAuthorityDecision {
  decision: TrackingEyesAuthorityDecisionState;
  policyRef: null;
  confidenceState: "provisional" | "unknown";
  reasonCodes: string[];
  lifecycleApplication: "not_applied";
}

const OBJECT_RESOLUTION_REQUIRED =
  "business_object_resolution_required" as const;

export function decideTrackingEyesSourceAuthority(
  normalization: TrackingEyesNormalizationResult,
): TrackingEyesAuthorityDecision {
  if (normalization.kind === "rejected") {
    return {
      decision: "rejected",
      policyRef: null,
      confidenceState: "unknown",
      reasonCodes: [normalization.reasonCode],
      lifecycleApplication: "not_applied",
    };
  }

  if (normalization.kind === "review_required") {
    return {
      decision: "review_required",
      policyRef: null,
      confidenceState: "unknown",
      reasonCodes: uniqueReasons([
        normalization.reasonCode,
        "source_authority_policy_required",
        OBJECT_RESOLUTION_REQUIRED,
      ]),
      lifecycleApplication: "not_applied",
    };
  }

  const candidate = normalization.candidate;
  const provisional =
    candidate.timeKind === "estimated" ||
    candidate.sourceSignal === "provider_computed";
  return {
    decision: "review_required",
    policyRef: null,
    confidenceState: provisional ? "provisional" : "unknown",
    reasonCodes: uniqueReasons([
      ...candidate.reviewReasons,
      OBJECT_RESOLUTION_REQUIRED,
    ]),
    lifecycleApplication: "not_applied",
  };
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}
