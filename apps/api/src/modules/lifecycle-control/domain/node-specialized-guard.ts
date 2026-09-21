import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import type { LifecycleLocationContext } from "./lifecycle-date-fact";
import type { ActiveOceanRouteSegment } from "./lifecycle.repository";
import type { NodeEventApplicationDecision } from "./node-event-application";

export function decideNodeSpecializedGuard(input: {
  targetNodeCode: LifecycleNodeCode;
  eventCode: CanonicalEventCode;
  containerNumber: string | null;
  location: LifecycleLocationContext | null;
  routeSegment: ActiveOceanRouteSegment | null;
  cargoReadyComplianceApproved?: boolean;
  stuffingReadiness?: {
    confirmed: boolean;
    reasonCode: string | null;
  } | null;
  dispatchReadiness?: {
    confirmed: boolean;
    reasonCode: string | null;
  } | null;
  customsReadiness?: {
    confirmed: boolean;
    reasonCode: string | null;
  } | null;
}): NodeEventApplicationDecision {
  if (
    input.targetNodeCode === "cargo_ready" &&
    input.eventCode === "cargo_ready"
  ) {
    return input.cargoReadyComplianceApproved
      ? { kind: "apply", guardResults: ["CARGO_READY_COMPLIANCE_APPROVED"] }
      : {
          kind: "pending_application",
          guardResults: [],
          reasonCode: "LIFECYCLE_EVENT_PENDING_COMPLIANCE",
        };
  }

  if (
    input.targetNodeCode === "customs_clearance" &&
    input.eventCode === "container_customs_completed"
  ) {
    if (!input.customsReadiness?.confirmed) {
      return {
        kind: "pending_application",
        guardResults: [],
        reasonCode:
          input.customsReadiness?.reasonCode ??
          "LIFECYCLE_EVENT_PENDING_CUSTOMS_CASE",
      };
    }
    return {
      kind: "apply",
      guardResults: [
        "CUSTOMS_FILING_ACCEPTED",
        "CUSTOMS_AUTHORITY_RELEASED",
        "CUSTOMS_ACTIVE_HOLDS_CLEARED",
        "CUSTOMS_EVIDENCE_LINKED",
      ],
    };
  }

  if (
    input.targetNodeCode === "shipment_dispatch" &&
    input.eventCode === "loaded"
  ) {
    if (!input.dispatchReadiness?.confirmed) {
      return {
        kind: "pending_application",
        guardResults: [],
        reasonCode:
          input.dispatchReadiness?.reasonCode ??
          "LIFECYCLE_EVENT_PENDING_DISPATCH_SNAPSHOT",
      };
    }
    return {
      kind: "apply",
      guardResults: [
        "CONTAINER_DISPATCH_SNAPSHOT_CURRENT",
        "CONTAINER_DISPATCH_STUFFING_CURRENT",
        "CONTAINER_DISPATCH_VGM_ACCEPTED",
        "CONTAINER_DISPATCH_EVIDENCE_LINKED",
      ],
    };
  }

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
    if (!input.stuffingReadiness?.confirmed) {
      return {
        kind: "pending_application",
        guardResults: ["CONTAINER_IDENTITY_BOUND"],
        reasonCode:
          input.stuffingReadiness?.reasonCode ??
          "LIFECYCLE_EVENT_PENDING_STUFFING_SNAPSHOT",
      };
    }
    return {
      kind: "apply",
      guardResults: [
        "CONTAINER_IDENTITY_BOUND",
        "CONTAINER_STUFFING_SNAPSHOT_CURRENT",
        "CONTAINER_STUFFING_EVIDENCE_LINKED",
      ],
    };
  }

  if (
    input.targetNodeCode === "ocean_transit" &&
    input.eventCode === "transit_arrived"
  ) {
    return decideArrivalContext(
      input.eventCode,
      input.location,
      input.routeSegment,
    );
  }

  if (
    ["ocean_transit", "destination_arrival"].includes(input.targetNodeCode) &&
    input.eventCode === "arrived"
  ) {
    return decideArrivalContext(
      input.eventCode,
      input.location,
      input.routeSegment,
    );
  }

  return { kind: "apply", guardResults: [] };
}

function decideArrivalContext(
  eventCode: "arrived" | "transit_arrived",
  location: LifecycleLocationContext | null,
  routeSegment: ActiveOceanRouteSegment | null,
): NodeEventApplicationDecision {
  if (
    !location ||
    !["port", "terminal"].includes(location.locationType) ||
    !location.unlocode ||
    !location.segmentId
  ) {
    return {
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_LOCATION_CONTEXT",
    };
  }
  if (!routeSegment) {
    return {
      kind: "pending_application",
      guardResults: [
        "ARRIVAL_LOCATION_IDENTIFIED",
        "ARRIVAL_SEGMENT_IDENTIFIED",
      ],
      reasonCode: "LIFECYCLE_EVENT_PENDING_ROUTE_CONTEXT",
    };
  }
  const expectedFinal = eventCode === "arrived";
  const locationTypeMatches =
    routeSegment.destinationLocationType === "port" ||
    location.locationType === "terminal";
  const locationMatches =
    locationTypeMatches &&
    location.unlocode === routeSegment.destinationUnlocode &&
    (!routeSegment.destinationLocationId ||
      location.locationId === routeSegment.destinationLocationId) &&
    (!routeSegment.destinationPortCallId ||
      location.portCallId === routeSegment.destinationPortCallId);
  if (routeSegment.isFinal !== expectedFinal || !locationMatches) {
    return {
      kind: "pending_application",
      guardResults: ["ARRIVAL_ROUTE_ACTIVE"],
      reasonCode: "LIFECYCLE_EVENT_ROUTE_MISMATCH",
    };
  }
  return {
    kind: "apply",
    guardResults: [
      "ARRIVAL_LOCATION_IDENTIFIED",
      "ARRIVAL_SEGMENT_IDENTIFIED",
      "ARRIVAL_ROUTE_ACTIVE",
      "ARRIVAL_SEGMENT_MATCHED",
      "ARRIVAL_DESTINATION_MATCHED",
    ],
  };
}
