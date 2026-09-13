import { hashOutboxPayload } from "./outbox-message";

export const FIRST_SLICE_CLIENT_ACTION = "lifecycle.apply_event";
export const FIRST_SLICE_CLIENT_ACTION_VERSION = 1;
export const FIRST_SLICE_CLIENT_TARGET_TYPE = "container";
export const FIRST_SLICE_CLIENT_TARGET_OWNER = "shipment-registry";

export type ReceptionState = "pending" | "received" | "duplicate" | "boundary_rejected";
export type BusinessDecisionState = "pending" | "accepted" | "rejected";
export type CommitState = "pending" | "committed" | "commit_failed";

export interface ClientOperationRecord {
  id: string;
  tenantId: string;
  actorType: string;
  actorId: string;
  actionCode: string;
  actionVersion: number;
  targetType: string;
  targetId: string;
  targetOwnerModule: string;
  correlationId: string;
  causationId: string | null;
  traceId: string;
  idempotencyKey: string;
  requestHash: string;
  receptionState: ReceptionState;
  businessDecisionState: BusinessDecisionState;
  commitState: CommitState;
  resultRefs: Array<{ entityType: string; entityId: string }>;
  rejectionReasonCode: string | null;
  attemptCount: number;
  receivedAt: Date | null;
  decidedAt: Date | null;
  committedAt: Date | null;
}

export function parseClientActionCode(raw: string): string {
  const actionCode = raw.trim();
  if (actionCode !== FIRST_SLICE_CLIENT_ACTION) {
    throw new Error("VALIDATION_FORMAT: actionCode 不受理");
  }
  return actionCode;
}

export function hashClientRequest(canonicalJson: string): string {
  return hashOutboxPayload(canonicalJson);
}

export function decideClientIdempotency(
  existingHash: string,
  incomingHash: string,
): "reuse" | "conflict" {
  return existingHash === incomingHash ? "reuse" : "conflict";
}

export function buildCommittedClientOperation(input: {
  id: string;
  tenantId: string;
  actorType: string;
  actorId: string;
  targetId: string;
  correlationId: string;
  traceId: string;
  idempotencyKey: string;
  requestHash: string;
  resultRefs: Array<{ entityType: string; entityId: string }>;
  now: Date;
}): ClientOperationRecord {
  return baseOperation(input, {
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    resultRefs: input.resultRefs,
    rejectionReasonCode: null,
    receivedAt: input.now,
    decidedAt: input.now,
    committedAt: input.now,
  });
}

export function buildRejectedClientOperation(input: {
  id: string;
  tenantId: string;
  actorType: string;
  actorId: string;
  targetId: string;
  correlationId: string;
  traceId: string;
  idempotencyKey: string;
  requestHash: string;
  rejectionReasonCode: string;
  now: Date;
}): ClientOperationRecord {
  const rejectionReasonCode = input.rejectionReasonCode.trim();
  if (!rejectionReasonCode) {
    throw new Error("VALIDATION_FORMAT: rejectionReasonCode 无效");
  }
  return baseOperation(input, {
    receptionState: "received",
    businessDecisionState: "rejected",
    commitState: "pending",
    resultRefs: [],
    rejectionReasonCode,
    receivedAt: input.now,
    decidedAt: input.now,
    committedAt: null,
  });
}

export function buildBoundaryRejectedClientOperation(input: {
  id: string;
  tenantId: string;
  actorType: string;
  actorId: string;
  targetId: string;
  correlationId: string;
  traceId: string;
  idempotencyKey: string;
  requestHash: string;
  rejectionReasonCode: string;
  now: Date;
}): ClientOperationRecord {
  return baseOperation(input, {
    receptionState: "boundary_rejected",
    businessDecisionState: "pending",
    commitState: "pending",
    resultRefs: [],
    rejectionReasonCode: input.rejectionReasonCode.trim() || "VALIDATION_FORMAT",
    receivedAt: input.now,
    decidedAt: null,
    committedAt: null,
  });
}

function baseOperation(
  input: {
    id: string;
    tenantId: string;
    actorType: string;
    actorId: string;
    targetId: string;
    correlationId: string;
    traceId: string;
    idempotencyKey: string;
    requestHash: string;
  },
  states: Pick<
    ClientOperationRecord,
    | "receptionState"
    | "businessDecisionState"
    | "commitState"
    | "resultRefs"
    | "rejectionReasonCode"
    | "receivedAt"
    | "decidedAt"
    | "committedAt"
  >,
): ClientOperationRecord {
  const tenantId = input.tenantId.trim();
  const actorId = input.actorId.trim();
  const targetId = input.targetId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!tenantId || !actorId || !targetId || !idempotencyKey) {
    throw new Error("VALIDATION_FORMAT: ClientOperation 字段无效");
  }
  return {
    id: input.id,
    tenantId,
    actorType: input.actorType,
    actorId,
    actionCode: FIRST_SLICE_CLIENT_ACTION,
    actionVersion: FIRST_SLICE_CLIENT_ACTION_VERSION,
    targetType: FIRST_SLICE_CLIENT_TARGET_TYPE,
    targetId,
    targetOwnerModule: FIRST_SLICE_CLIENT_TARGET_OWNER,
    correlationId: input.correlationId,
    causationId: null,
    traceId: input.traceId,
    idempotencyKey,
    requestHash: input.requestHash,
    attemptCount: 1,
    ...states,
  };
}
