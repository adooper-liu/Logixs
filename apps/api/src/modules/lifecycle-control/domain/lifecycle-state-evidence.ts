import type { CanonicalEventCode } from "@logix/contracts";
import type { LifecycleDateFactRecord } from "./lifecycle-date-fact";

export type LifecycleStateEvidenceDecision =
  | { kind: "accept"; authorityPolicyRef: string }
  | { kind: "reject"; reasonCode: string };

export function decideLifecycleStateEvidence(input: {
  fact: LifecycleDateFactRecord;
  tenantId: string;
  containerId: string;
  eventCode: CanonicalEventCode;
  occurredAt: Date;
  evidenceRefs: string[];
}): LifecycleStateEvidenceDecision {
  const { fact } = input;
  if (
    fact.tenantId !== input.tenantId ||
    fact.containerId !== input.containerId ||
    fact.eventCode !== input.eventCode ||
    fact.occurredAt.getTime() !== input.occurredAt.getTime() ||
    !sameRefs(fact.evidenceRefs, input.evidenceRefs)
  ) {
    return { kind: "reject", reasonCode: "LIFECYCLE_GUARD_NOT_SATISFIED" };
  }
  if (
    fact.timeKind !== "actual" ||
    fact.verificationState !== "verified" ||
    fact.confidenceState !== "confirmed" ||
    fact.validity !== "effective" ||
    !["pending_application", "applied"].includes(fact.applicationState)
  ) {
    return {
      kind: "reject",
      reasonCode: "LIFECYCLE_EVENT_NOT_STATE_EVIDENCE",
    };
  }
  if (!fact.authorityPolicyRef) {
    return {
      kind: "reject",
      reasonCode: "LIFECYCLE_SOURCE_NOT_AUTHORIZED",
    };
  }
  return { kind: "accept", authorityPolicyRef: fact.authorityPolicyRef };
}

function sameRefs(left: string[], right: string[]): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}
