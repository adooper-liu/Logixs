import { createHash } from "node:crypto";

export const WORK_FACT_RECONCILIATION_EVENT_TYPE =
  "work_execution.reconcile_applied_lifecycle_fact.requested";
export const WORK_FACT_RECONCILIATION_EVENT_VERSION = 1;
export const WORK_FACT_RECONCILIATION_AGGREGATE_TYPE = "node_event_application";

export interface WorkFactReconciliationIdentity {
  nodeEventApplicationId: string;
  tenantId: string;
  containerId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  canonicalEventId: string;
}

export interface WorkFactReconciliationOutboxPending {
  id: string;
  tenantId: string;
  ownerModule: "lifecycle-control";
  eventId: string;
  eventType: typeof WORK_FACT_RECONCILIATION_EVENT_TYPE;
  eventVersion: typeof WORK_FACT_RECONCILIATION_EVENT_VERSION;
  aggregateType: typeof WORK_FACT_RECONCILIATION_AGGREGATE_TYPE;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  causationId: string;
  state: "pending";
  attemptCount: 0;
  occurredAt: Date;
  idempotencyKey: string;
  traceId: string;
}

export function buildWorkFactReconciliationOutboxPending(
  input: WorkFactReconciliationIdentity & {
    occurredAt: Date;
    traceId: string;
  },
): WorkFactReconciliationOutboxPending {
  const eventId = reconciliationMessageId(
    input.canonicalEventId,
    input.nodeInstanceId,
  );
  return {
    id: eventId,
    tenantId: input.tenantId,
    ownerModule: "lifecycle-control",
    eventId,
    eventType: WORK_FACT_RECONCILIATION_EVENT_TYPE,
    eventVersion: WORK_FACT_RECONCILIATION_EVENT_VERSION,
    aggregateType: WORK_FACT_RECONCILIATION_AGGREGATE_TYPE,
    aggregateId: input.nodeEventApplicationId,
    payloadRef: workFactReconciliationPayloadRef(input.nodeEventApplicationId),
    payloadHash: hashWorkFactReconciliationPayload(input),
    causationId: input.canonicalEventId,
    state: "pending",
    attemptCount: 0,
    occurredAt: input.occurredAt,
    idempotencyKey: workFactReconciliationIdempotencyKey(input),
    traceId: input.traceId,
  };
}

export function workFactReconciliationPayloadRef(
  nodeEventApplicationId: string,
): string {
  return `node-event-application/${nodeEventApplicationId}`;
}

export function workFactReconciliationIdempotencyKey(input: {
  canonicalEventId: string;
  nodeInstanceId: string;
}): string {
  return `reconcile-applied-lifecycle-fact/${input.canonicalEventId}/${input.nodeInstanceId}`;
}

export function hashWorkFactReconciliationPayload(
  input: WorkFactReconciliationIdentity,
): string {
  return createHash("sha256")
    .update(canonicalizeWorkFactReconciliationPayload(input), "utf8")
    .digest("hex");
}

// Matches PostgreSQL jsonb::text used by the historical backfill migration.
export function canonicalizeWorkFactReconciliationPayload(
  input: WorkFactReconciliationIdentity,
): string {
  return `{${[
    ["tenantId", input.tenantId],
    ["containerId", input.containerId],
    ["flowInstanceId", input.flowInstanceId],
    ["nodeInstanceId", input.nodeInstanceId],
    ["canonicalEventId", input.canonicalEventId],
    ["nodeEventApplicationId", input.nodeEventApplicationId],
  ]
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ")}}`;
}

function reconciliationMessageId(
  canonicalEventId: string,
  nodeInstanceId: string,
): string {
  const hash = createHash("md5")
    .update(
      `work-fact-reconciliation:${canonicalEventId}:${nodeInstanceId}`,
      "utf8",
    )
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
