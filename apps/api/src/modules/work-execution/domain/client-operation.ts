import { createHash } from "node:crypto";

export const WORK_COMPLETE_ACTION = "work_execution.complete_work_order";
export const WORK_CLAIM_ACTION = "work_execution.claim_work_order";
export const WORK_COMPLETE_ACTION_VERSION = 1;
export const WORK_COMPLETE_TARGET_TYPE = "work_order";
export const WORK_COMPLETE_TARGET_OWNER = "work-execution";

export type ReceptionState =
  "pending" | "received" | "duplicate" | "boundary_rejected";
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

export function defaultCompleteIdempotencyKey(workOrderId: string): string {
  return `work-order:${workOrderId}:complete`;
}

export function defaultClaimIdempotencyKey(workOrderId: string): string {
  return `work-order:${workOrderId}:claim`;
}

export function parseClaimIdempotencyKey(
  raw: string | undefined,
  workOrderId: string,
): string {
  const idempotencyKey =
    (raw ?? "").trim() || defaultClaimIdempotencyKey(workOrderId);
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    throw new Error("VALIDATION_FORMAT: idempotencyKey 无效");
  }
  return idempotencyKey;
}

export function hashClaimRequest(input: { workOrderId: string }): string {
  return createHash("sha256")
    .update(JSON.stringify({ workOrderId: input.workOrderId }), "utf8")
    .digest("hex");
}

export function parseCompleteIdempotencyKey(
  raw: string | undefined,
  workOrderId: string,
): string {
  const idempotencyKey =
    (raw ?? "").trim() || defaultCompleteIdempotencyKey(workOrderId);
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    throw new Error("VALIDATION_FORMAT: idempotencyKey 无效");
  }
  return idempotencyKey;
}

export function hashCompleteRequest(input: {
  workOrderId: string;
  evidenceRefs: string[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        evidenceRefs: [...input.evidenceRefs].sort(),
        workOrderId: input.workOrderId,
      }),
      "utf8",
    )
    .digest("hex");
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
  actionCode?: string;
  actionVersion?: number;
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
  actionCode?: string;
  actionVersion?: number;
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
  actionCode?: string;
  actionVersion?: number;
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
    rejectionReasonCode:
      input.rejectionReasonCode.trim() || "VALIDATION_FORMAT",
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
    actionCode?: string;
    actionVersion?: number;
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
    actionCode: input.actionCode ?? WORK_COMPLETE_ACTION,
    actionVersion: input.actionVersion ?? WORK_COMPLETE_ACTION_VERSION,
    targetType: WORK_COMPLETE_TARGET_TYPE,
    targetId,
    targetOwnerModule: WORK_COMPLETE_TARGET_OWNER,
    correlationId: input.correlationId,
    causationId: null,
    traceId: input.traceId,
    idempotencyKey,
    requestHash: input.requestHash,
    attemptCount: 1,
    ...states,
  };
}
