import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import type { LifecycleLocationContext } from "./lifecycle-date-fact";
import type { ActiveOceanRouteSegment } from "./lifecycle.repository";
import type { NodeEventApplicationDecision } from "./node-event-application";

export interface DeliveryInstructionContext {
  instructionId: string;
  warehouseLocationId: string;
  unlocode: string | null;
  timezone: string;
}

export interface DeliveryEvidenceAuthorityContext {
  id: string;
  evidenceType: string;
  authorityLevel: string;
  sourceType: string;
  authoritySystem: string;
  verificationState: string;
  validity: string;
}

export interface PickupAvailabilityContext {
  occurredAt: Date;
  verificationState: string;
  confidenceState: string;
  validity: string;
  applicationState: string;
  location: LifecycleLocationContext | null;
}

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
  pickupAvailability?: PickupAvailabilityContext | null;
  deliveryInstruction?: DeliveryInstructionContext | null;
  evidenceAuthorityContexts?: DeliveryEvidenceAuthorityContext[];
  occurredAt: Date;
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
    input.targetNodeCode === "container_pickup" &&
    input.eventCode === "gate_out"
  ) {
    return decidePickupAvailability(
      input.pickupAvailability ?? null,
      input.location,
      input.occurredAt,
    );
  }

  if (
    input.targetNodeCode === "warehouse_delivery" &&
    ["delivered", "warehouse_arrival"].includes(input.eventCode)
  ) {
    return decideWarehouseDelivery(
      input.eventCode as "delivered" | "warehouse_arrival",
      input.deliveryInstruction ?? null,
      input.location,
      input.evidenceAuthorityContexts ?? [],
    );
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

function decideWarehouseDelivery(
  eventCode: "delivered" | "warehouse_arrival",
  instruction: DeliveryInstructionContext | null,
  location: LifecycleLocationContext | null,
  evidence: DeliveryEvidenceAuthorityContext[],
): NodeEventApplicationDecision {
  if (!instruction) {
    return {
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_DELIVERY_INSTRUCTION",
    };
  }
  if (
    !location ||
    location.locationType !== "warehouse" ||
    !location.locationId
  ) {
    return {
      kind: "pending_application",
      guardResults: ["DELIVERY_INSTRUCTION_CURRENT"],
      reasonCode: "LIFECYCLE_EVENT_PENDING_DELIVERY_LOCATION_CONTEXT",
    };
  }
  if (
    location.locationId !== instruction.warehouseLocationId ||
    (instruction.unlocode !== null &&
      location.unlocode !== instruction.unlocode)
  ) {
    return {
      kind: "pending_application",
      guardResults: [
        "DELIVERY_INSTRUCTION_CURRENT",
        "DELIVERY_LOCATION_IDENTIFIED",
      ],
      reasonCode: "LIFECYCLE_EVENT_DELIVERY_LOCATION_MISMATCH",
    };
  }
  const qualified = evidence.some((item) =>
    eventCode === "delivered"
      ? isQualifiedDeliveryReceipt(item)
      : isQualifiedWarehouseAuthorityEvidence(item),
  );
  if (!qualified) {
    return {
      kind: "pending_application",
      guardResults: [
        "DELIVERY_INSTRUCTION_CURRENT",
        "DELIVERY_LOCATION_IDENTIFIED",
        "DELIVERY_DESTINATION_MATCHED",
      ],
      reasonCode:
        eventCode === "delivered"
          ? "LIFECYCLE_EVENT_PENDING_DELIVERY_RECEIPT_EVIDENCE"
          : "LIFECYCLE_EVENT_PENDING_WAREHOUSE_AUTHORITY_EVIDENCE",
    };
  }
  return {
    kind: "apply",
    guardResults: [
      "DELIVERY_INSTRUCTION_CURRENT",
      "DELIVERY_LOCATION_IDENTIFIED",
      "DELIVERY_DESTINATION_MATCHED",
      eventCode === "delivered"
        ? "DELIVERY_RECEIPT_EVIDENCE_QUALIFIED"
        : "WAREHOUSE_AUTHORITY_EVIDENCE_QUALIFIED",
    ],
  };
}

function isQualifiedDeliveryReceipt(
  evidence: DeliveryEvidenceAuthorityContext,
): boolean {
  return (
    isEffectiveOperationalEvidence(evidence) &&
    evidence.evidenceType === "receipt" &&
    ["organization", "authority", "system"].includes(evidence.sourceType)
  );
}

function isQualifiedWarehouseAuthorityEvidence(
  evidence: DeliveryEvidenceAuthorityContext,
): boolean {
  return (
    isEffectiveOperationalEvidence(evidence) &&
    ["receipt", "system_record", "api_response"].includes(
      evidence.evidenceType,
    ) &&
    ["organization", "authority", "system"].includes(evidence.sourceType)
  );
}

function isEffectiveOperationalEvidence(
  evidence: DeliveryEvidenceAuthorityContext,
): boolean {
  return (
    evidence.verificationState === "verified" &&
    evidence.validity === "effective" &&
    ["authoritative", "operational"].includes(evidence.authorityLevel)
  );
}

function decidePickupAvailability(
  availability: PickupAvailabilityContext | null,
  gateOutLocation: LifecycleLocationContext | null,
  gateOutAt: Date,
): NodeEventApplicationDecision {
  if (
    !availability ||
    availability.verificationState !== "verified" ||
    availability.confidenceState !== "confirmed" ||
    availability.validity !== "effective" ||
    availability.applicationState !== "applied"
  ) {
    return {
      kind: "pending_application",
      guardResults: [],
      reasonCode: "LIFECYCLE_EVENT_PENDING_TERMINAL_AVAILABILITY",
    };
  }
  if (
    !isPortLocation(availability.location) ||
    !isPortLocation(gateOutLocation)
  ) {
    return {
      kind: "pending_application",
      guardResults: ["PICKUP_TERMINAL_AVAILABILITY_CONFIRMED"],
      reasonCode: "LIFECYCLE_EVENT_PENDING_PICKUP_LOCATION_CONTEXT",
    };
  }
  if (!sameOperationalLocation(availability.location, gateOutLocation)) {
    return {
      kind: "pending_application",
      guardResults: ["PICKUP_TERMINAL_AVAILABILITY_CONFIRMED"],
      reasonCode: "LIFECYCLE_EVENT_PICKUP_LOCATION_MISMATCH",
    };
  }
  if (gateOutAt.getTime() < availability.occurredAt.getTime()) {
    return {
      kind: "pending_application",
      guardResults: [
        "PICKUP_TERMINAL_AVAILABILITY_CONFIRMED",
        "PICKUP_LOCATION_MATCHED",
      ],
      reasonCode: "LIFECYCLE_EVENT_PICKUP_BEFORE_AVAILABLE",
    };
  }
  return {
    kind: "apply",
    guardResults: [
      "PICKUP_TERMINAL_AVAILABILITY_CONFIRMED",
      "PICKUP_LOCATION_MATCHED",
      "PICKUP_AFTER_AVAILABLE",
    ],
  };
}

function isPortLocation(
  location: LifecycleLocationContext | null,
): location is LifecycleLocationContext & { unlocode: string } {
  return Boolean(
    location &&
    ["port", "terminal"].includes(location.locationType) &&
    location.unlocode,
  );
}

function sameOperationalLocation(
  availability: LifecycleLocationContext & { unlocode: string },
  gateOut: LifecycleLocationContext & { unlocode: string },
): boolean {
  if (availability.unlocode !== gateOut.unlocode) return false;
  if (!sameOptionalIdentity(availability.locationId, gateOut.locationId))
    return false;
  return sameOptionalIdentity(availability.portCallId, gateOut.portCallId);
}

function sameOptionalIdentity(left?: string, right?: string): boolean {
  if (!left && !right) return true;
  return Boolean(left && right && left === right);
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
