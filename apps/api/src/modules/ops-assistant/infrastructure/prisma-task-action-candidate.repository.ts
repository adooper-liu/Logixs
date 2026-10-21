import { Injectable } from "@nestjs/common";
import type {
  OpsAssistantActionCandidate,
  OpsAssistantActionDecision,
  Prisma,
} from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { TASK_ACTION_CODE } from "../domain/task-action-candidate";
import {
  CandidateDecisionConflictError,
  CandidateNotFoundError,
  type TaskActionCandidatePersistenceInput,
  type TaskActionCandidateRecord,
  type TaskActionCandidateRepository,
  type TaskActionDecisionPersistenceInput,
  type TaskActionDecisionRecord,
  type TaskActionTypedRef,
} from "../domain/task-action-candidate.repository";

@Injectable()
export class PrismaTaskActionCandidateRepository implements TaskActionCandidateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCandidate(
    input: TaskActionCandidatePersistenceInput,
  ): Promise<TaskActionCandidateRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      const scope = await tx.$queryRaw<Array<{ taskId: string }>>`
        SELECT task."id" AS "taskId"
        FROM "node_task" AS task
        INNER JOIN "work_order" AS work_order
          ON work_order."node_task_id" = task."id"
        WHERE task."id" = ${input.context.workRef.id}
          AND task."tenant_id" = ${input.tenantId}
          AND task."container_id" = ${input.context.subjectRef.id}
          AND work_order."id" = ${input.workOrderId}
        FOR SHARE OF task, work_order
      `;
      if (scope.length !== 1) throw new CandidateNotFoundError();

      return tx.opsAssistantActionCandidate.create({
        data: {
          id: input.candidateId,
          tenantId: input.tenantId,
          actorId: input.actorId,
          subjectKind: input.context.subjectRef.kind,
          subjectId: input.context.subjectRef.id,
          workKind: input.context.workRef.kind,
          workId: input.context.workRef.id,
          workOrderId: input.workOrderId,
          actionCode: input.actionCode,
          actionVersion: input.actionVersion,
          title: input.title,
          rationale: input.rationale,
          impact: input.impact,
          riskLevel: input.riskLevel,
          warningCodes: [...input.warningCodes],
          status: input.status,
          candidateHash: input.candidateHash,
          sourceKind: input.source.kind,
          capabilityId: input.source.capabilityId,
          capabilityVersion: input.source.capabilityVersion,
          schemaVersion: input.source.schemaVersion,
          promptVersion: input.source.promptVersion,
          modelId: input.source.modelId,
          inputSnapshotHash: input.source.inputSnapshotHash,
          inputRefs: refsForWrite(input.source.inputRefs),
          generatedAt: input.source.generatedAt,
        },
        include: { decisions: true },
      });
    });
    return mapCandidate(row);
  }

  async findCandidate(input: {
    candidateId: string;
    tenantId: string;
    actorId: string;
  }): Promise<TaskActionCandidateRecord | null> {
    const row = await this.prisma.opsAssistantActionCandidate.findFirst({
      where: {
        id: input.candidateId,
        tenantId: input.tenantId,
        actorId: input.actorId,
      },
      include: { decisions: true },
    });
    return row ? mapCandidate(row) : null;
  }

  async appendDecision(input: {
    candidateId: string;
    tenantId: string;
    actorId: string;
    decision: TaskActionDecisionPersistenceInput;
  }): Promise<{
    decision: TaskActionDecisionRecord;
    idempotencyReplay: boolean;
  }> {
    return this.appendDecisionWithLock(
      {
        candidateId: input.candidateId,
        tenantId: input.tenantId,
        actorId: input.actorId,
        decision: input.decision.decision,
        idempotencyKey: input.decision.idempotencyKey,
        decisionHash: input.decision.decisionHash,
      },
      async () => input.decision,
    );
  }

  async appendDecisionWithLock(
    input: {
      candidateId: string;
      tenantId: string;
      actorId: string;
      decision: "accepted" | "rejected";
      idempotencyKey: string;
      decisionHash?: string;
    },
    buildDecision: (
      candidate: TaskActionCandidateRecord,
    ) => Promise<TaskActionDecisionPersistenceInput>,
  ): Promise<{
    decision: TaskActionDecisionRecord;
    idempotencyReplay: boolean;
  }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT true AS locked
          FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.candidateId}, 0))) AS acquired
        `;
          const candidate = await tx.opsAssistantActionCandidate.findFirst({
            where: {
              id: input.candidateId,
              tenantId: input.tenantId,
              actorId: input.actorId,
            },
            include: { decisions: true },
          });
          if (!candidate) throw new CandidateNotFoundError();
          const existing = candidate.decisions[0];
          if (existing) return replayIntentOrConflict(existing, input);

          if (input.decision === "accepted") {
            await tx.$queryRaw<Array<{ locked: boolean }>>`
              SELECT true AS locked
              FROM (
                SELECT pg_advisory_xact_lock(
                  hashtextextended(${`${input.tenantId}:${candidate.workOrderId}`}, 0)
                )
              ) AS acquired
            `;
          }

          const decisionInput = await buildDecision(mapCandidate(candidate));
          if (
            decisionInput.decision !== input.decision ||
            decisionInput.idempotencyKey !== input.idempotencyKey ||
            (input.decisionHash !== undefined &&
              decisionInput.decisionHash !== input.decisionHash)
          ) {
            throw new CandidateDecisionConflictError();
          }

          if (decisionInput.clientOperationId !== null) {
            const operation = await tx.clientOperation.findFirst({
              where: {
                id: decisionInput.clientOperationId,
                tenantId: candidate.tenantId,
                actorId: input.actorId,
                actionCode: TASK_ACTION_CODE,
                targetId: candidate.workOrderId,
              },
              select: { id: true },
            });
            if (!operation) throw new CandidateNotFoundError();
          }

          const decision = await tx.opsAssistantActionDecision.create({
            data: {
              id: decisionInput.decisionId,
              candidateId: input.candidateId,
              decidedByActorId: input.actorId,
              decision: decisionInput.decision,
              reason: decisionInput.reason,
              idempotencyKey: decisionInput.idempotencyKey,
              decisionHash: decisionInput.decisionHash,
              decidedAt: decisionInput.decidedAt,
              clientOperationId: decisionInput.clientOperationId,
              traceId: decisionInput.traceId,
              executionState: decisionInput.executionState,
              resultRefs: refsForWrite(decisionInput.resultRefs),
            },
          });
          return { decision: mapDecision(decision), idempotencyReplay: false };
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    } catch (error) {
      if (prismaErrorCode(error) !== "P2002") throw error;
      const candidate = await this.prisma.opsAssistantActionCandidate.findFirst(
        {
          where: {
            id: input.candidateId,
            tenantId: input.tenantId,
            actorId: input.actorId,
          },
          include: { decisions: true },
        },
      );
      if (!candidate) throw new CandidateNotFoundError();
      const existing = candidate.decisions[0];
      if (!existing) throw error;
      return replayIntentOrConflict(existing, input);
    }
  }
}

function replayIntentOrConflict(
  existing: Parameters<typeof mapDecision>[0],
  input: {
    actorId: string;
    decision: "accepted" | "rejected";
    idempotencyKey: string;
    decisionHash?: string;
  },
) {
  if (
    existing.decidedByActorId !== input.actorId ||
    existing.decision !== input.decision ||
    existing.idempotencyKey !== input.idempotencyKey ||
    (input.decisionHash !== undefined &&
      existing.decisionHash !== input.decisionHash)
  ) {
    throw new CandidateDecisionConflictError();
  }
  return { decision: mapDecision(existing), idempotencyReplay: true };
}

type CandidateRow = OpsAssistantActionCandidate & {
  decisions: OpsAssistantActionDecision[];
};

function mapCandidate(row: CandidateRow): TaskActionCandidateRecord {
  return {
    candidateId: row.id,
    tenantId: row.tenantId,
    actorId: row.actorId,
    context: {
      subjectRef: { kind: "container", id: row.subjectId },
      workRef: { kind: "node_task", id: row.workId },
    },
    workOrderId: row.workOrderId,
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: row.title,
    rationale: row.rationale,
    impact: row.impact,
    riskLevel: "low",
    warningCodes: [...row.warningCodes].sort(),
    status: "proposed",
    candidateHash: row.candidateHash,
    source: {
      kind: row.sourceKind as TaskActionCandidateRecord["source"]["kind"],
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: row.promptVersion,
      modelId: row.modelId,
      inputSnapshotHash: row.inputSnapshotHash,
      inputRefs: refs(row.inputRefs),
      generatedAt: row.generatedAt,
    },
    recordedAt: row.recordedAt,
    decisions: row.decisions.map(mapDecision),
  };
}

function mapDecision(
  row: OpsAssistantActionDecision,
): TaskActionDecisionRecord {
  return {
    decisionId: row.id,
    candidateId: row.candidateId,
    decidedByActorId: row.decidedByActorId,
    decision: row.decision as TaskActionDecisionRecord["decision"],
    reason: row.reason,
    idempotencyKey: row.idempotencyKey,
    decisionHash: row.decisionHash,
    decidedAt: row.decidedAt,
    clientOperationId: row.clientOperationId,
    traceId: row.traceId,
    executionState:
      row.executionState as TaskActionDecisionRecord["executionState"],
    resultRefs: refs(row.resultRefs),
    recordedAt: row.recordedAt,
  };
}

function refs(value: unknown): TaskActionTypedRef[] {
  return Array.isArray(value) ? (value as TaskActionTypedRef[]) : [];
}

function refsForWrite(
  value: readonly TaskActionTypedRef[],
): Prisma.InputJsonArray {
  return value.map((ref) => {
    const keys = Object.keys(ref).sort();
    if (
      keys.length !== 3 ||
      keys[0] !== "id" ||
      keys[1] !== "kind" ||
      keys[2] !== "version"
    ) {
      throw new Error("INVALID_TYPED_REFERENCE");
    }
    return { kind: ref.kind, id: ref.id, version: ref.version };
  });
}

function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}
