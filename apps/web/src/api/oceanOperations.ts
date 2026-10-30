import { requestJson } from "./httpClient";

export type SourceReviewDecision =
  "review_required" | "adopt_observation_for_review" | "reject_observation";
export type ArrivalPreparationResult =
  | "usable_for_customs_preparation"
  | "pending_evidence"
  | "not_suitable_for_customs_preparation";
export interface OceanOperationsQueueItem {
  containerId: string;
  containerNumber: string | null;
  shipmentNumber: string | null;
  status: string;
  observationCount: number;
  conflictCount: number;
  reviewDecision: SourceReviewDecision | null;
  updatedAt: string;
}
export interface SourceObservation {
  id: string;
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
export interface OceanFocusItem {
  code: "progress" | "arrival_change" | "route_risk" | "information" | "coordination";
  title: string;
  status: "information" | "attention" | "unavailable";
  summary: string;
  evidence: string[];
  standard: string;
  trigger: string | null;
  actions: ("view_sources" | "record_assessment")[];
}

export interface OceanStandardExplanation {
  rawCode: string | null;
  canonicalCode: string | null;
  name: string | null;
  status: "recognized" | "pending_review" | "unrecognized" | "unavailable";
  version: string | null;
}

export interface OceanOperationsProjection {
  standards?: { carrier: OceanStandardExplanation; containerType: OceanStandardExplanation; origin: OceanStandardExplanation; destination: OceanStandardExplanation };
  container: { id: string; number: string | null; status: string; typeCode?: string | null };
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

export async function listOceanOperationsQueue(
  containerNumber?: string,
): Promise<OceanOperationsQueueItem[]> {
  const query = containerNumber
    ? `?containerNumber=${encodeURIComponent(containerNumber)}`
    : "";
  const result = await requestJson<{ items: OceanOperationsQueueItem[] }>(
    `/api/ocean-operations/source-reviews${query}`,
    { fallback: "读取海运运输待办失败" },
  );
  return result.items;
}

export function getOceanOperationsProjection(
  containerId: string,
): Promise<OceanOperationsProjection> {
  return requestJson<OceanOperationsProjection>(
    `/api/ocean-operations/source-reviews/${encodeURIComponent(containerId)}`,
    { fallback: "读取海运运输事项失败" },
  );
}

export function saveOceanOperationsReview(
  containerId: string,
  body: {
    sourceObservationId: string;
    reviewDecision: SourceReviewDecision;
    reason: string;
    expectedVersion: number;
    idempotencyKey: string;
    arrivalPreparationResult: ArrivalPreparationResult;
    nextStep: string;
    expectedArrivalPreparationVersion: number;
  },
): Promise<{
  recordState: "recorded" | "duplicate";
  review: OceanOperationsProjection["review"];
  arrivalPreparation: OceanOperationsProjection["arrivalPreparation"];
}> {
  return requestJson(
    `/api/ocean-operations/source-reviews/${encodeURIComponent(containerId)}`,
    { method: "POST", body, fallback: "记录到港准备判断失败" },
  );
}
