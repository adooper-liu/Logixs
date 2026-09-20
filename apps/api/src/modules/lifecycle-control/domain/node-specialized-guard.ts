import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import type { NodeEventApplicationDecision } from "./node-event-application";

export function decideNodeSpecializedGuard(input: {
  targetNodeCode: LifecycleNodeCode;
  eventCode: CanonicalEventCode;
  containerNumber: string | null;
}): NodeEventApplicationDecision {
  if (
    input.targetNodeCode === "container_stuffing" &&
    input.eventCode === "stuffed"
  ) {
    if (!input.containerNumber?.trim()) {
      return {
        kind: "pending_application",
        guardResults: [],
        reasonCode: "LIFECYCLE_EVENT_PENDING_CONTAINER_IDENTITY",
      };
    }
    return { kind: "apply", guardResults: ["CONTAINER_IDENTITY_BOUND"] };
  }

  return { kind: "apply", guardResults: [] };
}
