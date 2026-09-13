import type { ClientOperationRecord } from "../domain/client-operation";

export function clientOperationCreateData(record: ClientOperationRecord) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    actorType: record.actorType,
    actorId: record.actorId,
    actionCode: record.actionCode,
    actionVersion: record.actionVersion,
    targetType: record.targetType,
    targetId: record.targetId,
    targetOwnerModule: record.targetOwnerModule,
    correlationId: record.correlationId,
    causationId: record.causationId,
    traceId: record.traceId,
    idempotencyKey: record.idempotencyKey,
    requestHash: record.requestHash,
    receptionState: record.receptionState,
    businessDecisionState: record.businessDecisionState,
    commitState: record.commitState,
    resultRefs: record.resultRefs,
    rejectionReasonCode: record.rejectionReasonCode,
    attemptCount: record.attemptCount,
    receivedAt: record.receivedAt,
    decidedAt: record.decidedAt,
    committedAt: record.committedAt,
  };
}
