import { createHash } from "node:crypto";
import type { CanonicalEventCode, LifecycleNodeCode } from "@logix/contracts";
import type { LifecycleLocationContext } from "./lifecycle-date-fact";

export const LIFECYCLE_OUTBOX_OWNER = "lifecycle-control";
export const LIFECYCLE_OUTBOX_EVENT_VERSION = 1;
export const LIFECYCLE_OUTBOX_AGGREGATE_TYPE = "container";

export interface LifecycleOutboxPending {
  id: string;
  tenantId: string;
  ownerModule: typeof LIFECYCLE_OUTBOX_OWNER;
  eventId: string;
  eventType: CanonicalEventCode;
  eventVersion: typeof LIFECYCLE_OUTBOX_EVENT_VERSION;
  aggregateType: typeof LIFECYCLE_OUTBOX_AGGREGATE_TYPE;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  state: "pending";
  attemptCount: 0;
  occurredAt: Date;
  idempotencyKey: string;
  traceId: string;
}

export function canonicalizeLifecycleOutboxPayload(input: {
  containerId: string;
  eventCode: CanonicalEventCode;
  domainFactId: string;
  nodeCode: LifecycleNodeCode;
  timeKind: "actual";
  authorityPolicyRef: string;
  location: LifecycleLocationContext | null;
  occurredAt: Date;
  evidenceRefs: string[];
  idempotencyKey: string;
}): string {
  return JSON.stringify({
    containerId: input.containerId,
    authorityPolicyRef: input.authorityPolicyRef,
    domainFactId: input.domainFactId,
    eventCode: input.eventCode,
    evidenceRefs: input.evidenceRefs,
    idempotencyKey: input.idempotencyKey,
    location: input.location,
    nodeCode: input.nodeCode,
    occurredAt: input.occurredAt.toISOString(),
    timeKind: input.timeKind,
  });
}

export function hashOutboxPayload(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

export function buildLifecycleOutboxPending(input: {
  eventId: string;
  tenantId: string;
  containerId: string;
  eventCode: CanonicalEventCode;
  domainFactId: string;
  nodeCode: LifecycleNodeCode;
  timeKind: "actual";
  authorityPolicyRef: string;
  location: LifecycleLocationContext | null;
  occurredAt: Date;
  evidenceRefs: string[];
  idempotencyKey: string;
  traceId: string;
}): LifecycleOutboxPending {
  const payload = canonicalizeLifecycleOutboxPayload(input);
  return {
    id: input.eventId,
    tenantId: input.tenantId,
    ownerModule: LIFECYCLE_OUTBOX_OWNER,
    eventId: input.eventId,
    eventType: input.eventCode,
    eventVersion: LIFECYCLE_OUTBOX_EVENT_VERSION,
    aggregateType: LIFECYCLE_OUTBOX_AGGREGATE_TYPE,
    aggregateId: input.containerId,
    payloadRef: `canonical-event/${input.eventId}`,
    payloadHash: hashOutboxPayload(payload),
    state: "pending",
    attemptCount: 0,
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    traceId: input.traceId,
  };
}
