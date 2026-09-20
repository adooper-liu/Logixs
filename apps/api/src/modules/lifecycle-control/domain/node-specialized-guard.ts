import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import type { LifecycleLocationContext } from "./lifecycle-date-fact";
import type { NodeEventApplicationDecision } from "./node-event-application";

export function decideNodeSpecializedGuard(input: {
  targetNodeCode: LifecycleNodeCode;
  eventCode: CanonicalEventCode;
  containerNumber: string | null;
  location: LifecycleLocationContext | null;
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

  if (
    input.targetNodeCode === "ocean_transit" &&
    input.eventCode === "transit_arrived"
  ) {
    return decideArrivalContext(input.location);
  }

  if (
    ["ocean_transit", "destination_arrival"].includes(input.targetNodeCode) &&
    input.eventCode === "arrived"
  ) {
    return decideArrivalContext(input.location);
  }

  return { kind: "apply", guardResults: [] };
}

function decideArrivalContext(
  location: LifecycleLocationContext | null,
): NodeEventApplicationDecision {
  if (
    !location ||
    !["port", "terminal"].includes(location.locationType) ||
    (!location.locationId && !location.unlocode) ||
    !location.segmentId
  ) {
    return {
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_LOCATION_CONTEXT",
    };
  }
  return {
    kind: "apply",
    guardResults: ["ARRIVAL_LOCATION_IDENTIFIED", "ARRIVAL_SEGMENT_IDENTIFIED"],
  };
}
