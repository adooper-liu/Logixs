import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  BusinessDecisionState,
  ClientOperationRecord,
  CommitState,
  ReceptionState,
} from "../domain/client-operation";
import { WORK_COMPLETE_ACTION } from "../domain/client-operation";
import type { WorkClientOperationRepository } from "../domain/client-operation.repository";
import { clientOperationCreateData } from "./client-operation-persist";

@Injectable()
export class PrismaWorkClientOperationRepository implements WorkClientOperationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByIdempotency(input: {
    tenantId: string;
    actorId: string;
    actionCode: string;
    idempotencyKey: string;
  }): Promise<ClientOperationRecord | null> {
    const row = await this.prisma.clientOperation.findUnique({
      where: {
        tenantId_actorId_actionCode_idempotencyKey: {
          tenantId: input.tenantId,
          actorId: input.actorId,
          actionCode: input.actionCode,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    return row ? toRecord(row) : null;
  }

  async insert(record: ClientOperationRecord): Promise<void> {
    await this.prisma.clientOperation.create({
      data: clientOperationCreateData(record),
    });
  }
}

function toRecord(row: {
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
  receptionState: string;
  businessDecisionState: string;
  commitState: string;
  resultRefs: unknown;
  rejectionReasonCode: string | null;
  attemptCount: number;
  receivedAt: Date | null;
  decidedAt: Date | null;
  committedAt: Date | null;
}): ClientOperationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorType: row.actorType,
    actorId: row.actorId,
    actionCode: row.actionCode || WORK_COMPLETE_ACTION,
    actionVersion: row.actionVersion,
    targetType: row.targetType,
    targetId: row.targetId,
    targetOwnerModule: row.targetOwnerModule,
    correlationId: row.correlationId,
    causationId: row.causationId,
    traceId: row.traceId,
    idempotencyKey: row.idempotencyKey,
    requestHash: row.requestHash,
    receptionState: row.receptionState as ReceptionState,
    businessDecisionState: row.businessDecisionState as BusinessDecisionState,
    commitState: row.commitState as CommitState,
    resultRefs: Array.isArray(row.resultRefs)
      ? (row.resultRefs as Array<{ entityType: string; entityId: string }>)
      : [],
    rejectionReasonCode: row.rejectionReasonCode,
    attemptCount: row.attemptCount,
    receivedAt: row.receivedAt,
    decidedAt: row.decidedAt,
    committedAt: row.committedAt,
  };
}
