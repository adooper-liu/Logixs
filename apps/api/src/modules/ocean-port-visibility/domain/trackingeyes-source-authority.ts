import type { TrackingEyesNormalizationResult } from "./trackingeyes-event-candidate";

export type TrackingEyesAuthorityDecisionState = "review_required" | "rejected";

export interface TrackingEyesAuthorityDecision {
  decision: TrackingEyesAuthorityDecisionState;
  policyRef: null;
  confidenceState: "provisional" | "unknown";
  reasonCodes: string[];
  lifecycleApplication: "not_applied";
}

export type TrackingEyesObjectResolution =
  | { state: "resolved"; containerId: string }
  | { state: "not_found"; containerId: null }
  | { state: "ambiguous"; containerId: null }
  | { state: "not_attempted"; containerId: null };

export function decideTrackingEyesSourceAuthority(
  normalization: TrackingEyesNormalizationResult,
  objectResolution: TrackingEyesObjectResolution = {
    state: "not_attempted",
    containerId: null,
  },
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
        objectResolutionReason(objectResolution),
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
      objectResolutionReason(objectResolution),
    ]),
    lifecycleApplication: "not_applied",
  };
}

function objectResolutionReason(
  resolution: TrackingEyesObjectResolution,
): string | null {
  if (resolution.state === "resolved") return null;
  if (resolution.state === "not_found") return "business_object_not_found";
  if (resolution.state === "ambiguous") return "business_object_ambiguous";
  return "business_object_resolution_required";
}

function uniqueReasons(reasons: Array<string | null>): string[] {
  return [...new Set(reasons.filter((reason): reason is string => !!reason))];
}
