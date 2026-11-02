export interface OceanDeadlineContext {
  query: {
    portId: string;
    shippingCompanyId: string;
    freightForwarderId: string;
    transportMode?: string | null;
    terminalId?: string | null;
    referenceAt: Date;
  } | null;
  calendarBasis: string | null;
  facts: {
    estimatedArrival: {
      at: Date;
      sourceRef: string;
      sourceVersion: string;
    } | null;
    estimatedDischarge: {
      at: Date;
      sourceRef: string;
      sourceVersion: string;
    } | null;
    estimatedPickup: {
      at: Date;
      sourceRef: string;
      sourceVersion: string;
    } | null;
    actualArrival: {
      at: Date;
      sourceRef: string;
      sourceVersion: string;
    } | null;
    actualDischarge: {
      at: Date;
      sourceRef: string;
      sourceVersion: string;
    } | null;
    actualPickup: { at: Date; sourceRef: string; sourceVersion: string } | null;
  };
}

export const SOURCE_REVIEW_DECISIONS = [
  "review_required",
  "adopt_observation_for_review",
  "reject_observation",
] as const;

export type SourceReviewDecision = (typeof SOURCE_REVIEW_DECISIONS)[number];

export const ARRIVAL_PREPARATION_RESULTS = [
  "usable_for_customs_preparation",
  "pending_evidence",
  "not_suitable_for_customs_preparation",
] as const;

export type ArrivalPreparationResult =
  (typeof ARRIVAL_PREPARATION_RESULTS)[number];

import type { OceanFocusItem } from "./ocean-operations-focus";

export interface SourceObservation {
  id: string;
  nodeCode?: string | null;
  segmentId?: string | null;
  unlocode?: string | null;
  supersedesObservationId?: string | null;
  reviewRequired?: boolean;
  semanticKey: string;
  sourceSystem: string;
  sourceVersion: string;
  parseState: string;
  sourcePrecision: string;
  rawValue: string;
  normalizedValue: string | null;
  timeKind: string | null;
  evidenceRefs: string[];
  isCurrent: boolean;
  conflict: boolean;
}

export interface OceanOperationsReviewProjection {
  deadlineContext?: OceanDeadlineContext;
  container: {
    id: string;
    number: string | null;
    typeCode?: string | null;
    status: string;
  };
  shipment: {
    id: string;
    number: string | null;
    carrier: string | null;
    vessel: string | null;
    voyage: string | null;
    billNumbers: string[];
    plannedDepartureAt: string | null;
    actualDepartureAt: string | null;
    actualDepartureSource: {
      classification: string;
      sourceVersion: string;
      sourcePrecision: string;
    } | null;
    origin: { code: string | null; name: string | null };
    destination: { code: string | null; name: string | null };
  } | null;
  references: {
    replenishmentOrderNumber: string | null;
    houseBillNumber: string | null;
  };
  task: {
    title: string;
    question: string;
    currentResponsibility: string;
    deadline: string | null;
    deadlineStatus: "unknown";
  };
  focus: OceanFocusItem[];
  observations: SourceObservation[];
  review: {
    id: string;
    decision: SourceReviewDecision;
    reason: string;
    version: number;
    sourceObservationId: string;
    reviewedAt: string;
    writeBackTarget: string;
  } | null;
  arrivalPreparation: {
    id: string;
    result: ArrivalPreparationResult;
    reason: string;
    sourceObservationId: string;
    sourceVersion: string;
    purpose: "customs_arrival_preparation";
    currentResponsibility: "海运运营";
    nextStep: string;
    version: number;
    recordedAt: string;
  } | null;
  downstream: {
    status: "not_connected";
    message: string;
    purpose: string;
    missingFacts: string[];
    nextStep: string;
  };
  financialProjection: {
    incomeContribution: { status: "awaiting_actual"; message: string };
    costFee: {
      status: "source_amount_pending_verification" | "not_connected";
      amount: string | null;
      currency: string | null;
      sourceReference: string | null;
      message: string;
    };
    cash: { status: "awaiting_actual"; message: string };
    inventory: { status: "awaiting_actual"; message: string };
  };
  traceability: {
    sourceVersion: string | null;
    reviewVersion: number | null;
    arrivalPreparationVersion: number | null;
    consumer: "customs_arrival_preparation";
    actualArrivalStatus: "awaiting_actual";
  };
}

export interface SourceReviewQueueItem {
  containerId: string;
  containerNumber: string | null;
  shipmentNumber: string | null;
  status: string;
  observationCount: number;
  conflictCount: number;
  reviewDecision: SourceReviewDecision | null;
  updatedAt: string;
}
