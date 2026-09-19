import { createHash } from "node:crypto";

export const NODE_BLOCK_OUTBOX_OWNER = "lifecycle-control";
export const NODE_BLOCK_EVENT_VERSION = 1;
export const NODE_BLOCK_AGGREGATE_TYPE = "container";

export interface NodeBlockOutboxPending {
  id: string;
  tenantId: string;
  ownerModule: typeof NODE_BLOCK_OUTBOX_OWNER;
  eventId: string;
  eventType: "lifecycle.node_blocked" | "lifecycle.node_block_resolved";
  eventVersion: typeof NODE_BLOCK_EVENT_VERSION;
  aggregateType: typeof NODE_BLOCK_AGGREGATE_TYPE;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  state: "pending";
  attemptCount: 0;
  occurredAt: Date;
  idempotencyKey: string;
  traceId: string;
}

export function buildNodeBlockedOutbox(input: {
  tenantId: string;
  flowInstanceId: string;
  containerId: string;
  nodeInstanceId: string;
  blockId: string;
  blockType: string;
  sourceFactId: string;
  occurredAt: Date;
  projectionVersion: number;
  idempotencyKey: string;
  traceId: string;
}): NodeBlockOutboxPending {
  return build({
    eventId: input.blockId,
    eventType: "lifecycle.node_blocked",
    tenantId: input.tenantId,
    aggregateId: input.containerId,
    payloadRef: `node-block/${input.blockId}`,
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    traceId: input.traceId,
    payload: {
      eventId: input.blockId,
      eventType: "lifecycle.node_blocked",
      eventVersion: NODE_BLOCK_EVENT_VERSION,
      tenantId: input.tenantId,
      flowInstanceId: input.flowInstanceId,
      containerId: input.containerId,
      nodeInstanceId: input.nodeInstanceId,
      blockId: input.blockId,
      blockType: input.blockType,
      sourceFactId: input.sourceFactId,
      occurredAt: input.occurredAt,
      projectionVersion: input.projectionVersion,
      traceId: input.traceId,
    },
  });
}

export function buildNodeBlockResolvedOutbox(input: {
  resolutionId: string;
  tenantId: string;
  flowInstanceId: string;
  containerId: string;
  nodeInstanceId: string;
  blockId: string;
  resolvedAt: Date;
  reasonCode: string;
  projectionVersion: number;
  idempotencyKey: string;
  traceId: string;
}): NodeBlockOutboxPending {
  return build({
    eventId: input.resolutionId,
    eventType: "lifecycle.node_block_resolved",
    tenantId: input.tenantId,
    aggregateId: input.containerId,
    payloadRef: `node-block-resolution/${input.resolutionId}`,
    occurredAt: input.resolvedAt,
    idempotencyKey: input.idempotencyKey,
    traceId: input.traceId,
    payload: {
      eventId: input.resolutionId,
      eventType: "lifecycle.node_block_resolved",
      eventVersion: NODE_BLOCK_EVENT_VERSION,
      tenantId: input.tenantId,
      flowInstanceId: input.flowInstanceId,
      containerId: input.containerId,
      nodeInstanceId: input.nodeInstanceId,
      blockId: input.blockId,
      resolvedAt: input.resolvedAt,
      reasonCode: input.reasonCode,
      projectionVersion: input.projectionVersion,
      traceId: input.traceId,
    },
  });
}

function build(input: {
  eventId: string;
  eventType: NodeBlockOutboxPending["eventType"];
  tenantId: string;
  aggregateId: string;
  payloadRef: string;
  occurredAt: Date;
  idempotencyKey: string;
  traceId: string;
  payload: object;
}): NodeBlockOutboxPending {
  return {
    id: input.eventId,
    tenantId: input.tenantId,
    ownerModule: NODE_BLOCK_OUTBOX_OWNER,
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: NODE_BLOCK_EVENT_VERSION,
    aggregateType: NODE_BLOCK_AGGREGATE_TYPE,
    aggregateId: input.aggregateId,
    payloadRef: input.payloadRef,
    payloadHash: createHash("sha256")
      .update(canonicalize(input.payload), "utf8")
      .digest("hex"),
    state: "pending",
    attemptCount: 0,
    occurredAt: input.occurredAt,
    idempotencyKey: input.idempotencyKey,
    traceId: input.traceId,
  };
}

function canonicalize(payload: object): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(payload)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [
          key,
          value instanceof Date ? value.toISOString() : value,
        ]),
    ),
  );
}
