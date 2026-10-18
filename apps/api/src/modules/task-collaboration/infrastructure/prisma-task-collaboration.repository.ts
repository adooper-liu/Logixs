import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { NormalizedCollaborationPostCommand } from "../domain/task-collaboration";
import {
  CollaborationIdempotencyConflictError,
  CollaborationParentNotFoundError,
  CollaborationPersistenceConflictError,
  type CollaborationMessageRecord,
  type CollaborationScope,
  type CollaborationThreadRecord,
  type TaskCollaborationRepository,
} from "../domain/task-collaboration.repository";

@Injectable()
export class PrismaTaskCollaborationRepository implements TaskCollaborationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findThread(
    scope: CollaborationScope,
  ): Promise<CollaborationThreadRecord | null> {
    const row = await this.prisma.taskCollaborationThread.findUnique({
      where: {
        tenantId_subjectKind_subjectId_workKind_workId_visibilityScope: scope,
      },
    });
    return row ? mapThread(row) : null;
  }

  async listMessages(input: {
    threadId: string;
    asOf: Date;
    after?: { recordedAt: Date; id: string };
    take: number;
  }): Promise<CollaborationMessageRecord[]> {
    const rows = await this.prisma.taskCollaborationMessage.findMany({
      where: {
        threadId: input.threadId,
        recordedAt: { lte: input.asOf },
        ...(input.after
          ? {
              OR: [
                { recordedAt: { lt: input.after.recordedAt } },
                {
                  recordedAt: input.after.recordedAt,
                  id: { lt: input.after.id },
                },
              ],
            }
          : {}),
      },
      include: MESSAGE_INCLUDE,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      take: input.take,
    });
    return rows.map(mapMessage);
  }

  async appendMessage(input: {
    scope: CollaborationScope;
    tenantId: string;
    authorActorId: string;
    command: NormalizedCollaborationPostCommand;
    occurredAt: Date;
  }): Promise<{
    thread: CollaborationThreadRecord;
    message: CollaborationMessageRecord;
    idempotencyReplay: boolean;
  }> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.appendTransaction(input);
      } catch (error) {
        const code = prismaErrorCode(error);
        if ((code === "P2002" || code === "P2034") && attempt < 2) continue;
        if (code === "P2002" || code === "P2034") {
          throw new CollaborationPersistenceConflictError();
        }
        throw error;
      }
    }
    throw new CollaborationPersistenceConflictError();
  }

  private appendTransaction(input: {
    scope: CollaborationScope;
    tenantId: string;
    authorActorId: string;
    command: NormalizedCollaborationPostCommand;
    occurredAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = scopeKey(input.scope);
      await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT true AS locked
        FROM (SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))) AS acquired
      `;

      let thread = await tx.taskCollaborationThread.findUnique({
        where: {
          tenantId_subjectKind_subjectId_workKind_workId_visibilityScope:
            input.scope,
        },
      });
      thread ??= await tx.taskCollaborationThread.create({
        data: {
          ...input.scope,
          policyVersion: 1,
          createdByActorId: input.authorActorId,
        },
      });

      const replay = await tx.taskCollaborationMessage.findUnique({
        where: {
          threadId_authorActorId_idempotencyKey: {
            threadId: thread.id,
            authorActorId: input.authorActorId,
            idempotencyKey: input.command.idempotencyKey,
          },
        },
        include: MESSAGE_INCLUDE,
      });
      if (replay) {
        if (replay.payloadHash !== input.command.payloadHash) {
          throw new CollaborationIdempotencyConflictError();
        }
        return {
          thread: mapThread(thread),
          message: mapMessage(replay),
          idempotencyReplay: true,
        };
      }

      if (input.command.parentMessageId) {
        const parent = await tx.taskCollaborationMessage.findFirst({
          where: {
            id: input.command.parentMessageId,
            threadId: thread.id,
          },
          select: { id: true },
        });
        if (!parent) throw new CollaborationParentNotFoundError();
      }

      const message = await tx.taskCollaborationMessage.create({
        data: {
          threadId: thread.id,
          authorActorId: input.authorActorId,
          parentMessageId: input.command.parentMessageId,
          body: input.command.body,
          occurredAt: input.occurredAt,
          idempotencyKey: input.command.idempotencyKey,
          payloadHash: input.command.payloadHash,
          mentions: {
            create: input.command.mentionActorIds.map((actorId) => ({
              actorId,
            })),
          },
          evidenceRefs: {
            create: input.command.evidenceRecordIds.map((evidenceRecordId) => ({
              evidenceRecordId,
            })),
          },
          sourceRefs: {
            create: input.command.sourceRefs.map((ref) => ({
              sourceKind: ref.kind,
              sourceId: ref.id,
              sourceVersion: ref.version,
            })),
          },
        },
        include: MESSAGE_INCLUDE,
      });
      return {
        thread: mapThread(thread),
        message: mapMessage(message),
        idempotencyReplay: false,
      };
    });
  }
}

const MESSAGE_INCLUDE = {
  mentions: true,
  evidenceRefs: true,
  sourceRefs: true,
} as const;

function mapThread(row: {
  id: string;
  tenantId: string;
  subjectKind: string;
  subjectId: string;
  workKind: string;
  workId: string;
  visibilityScope: string;
  policyVersion: number;
  createdByActorId: string;
  createdAt: Date;
}): CollaborationThreadRecord {
  return {
    ...row,
    subjectKind: "container",
    workKind: "node_task",
    visibilityScope: "task_scope",
  };
}

function mapMessage(row: {
  id: string;
  threadId: string;
  authorActorId: string;
  parentMessageId: string | null;
  body: string;
  occurredAt: Date;
  recordedAt: Date;
  mentions: Array<{ actorId: string }>;
  evidenceRefs: Array<{ evidenceRecordId: string }>;
  sourceRefs: Array<{
    sourceKind: string;
    sourceId: string;
    sourceVersion: number | null;
  }>;
}): CollaborationMessageRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    authorActorId: row.authorActorId,
    parentMessageId: row.parentMessageId,
    body: row.body,
    occurredAt: row.occurredAt,
    recordedAt: row.recordedAt,
    mentions: row.mentions.map(({ actorId }) => actorId).sort(),
    evidenceRecordIds: row.evidenceRefs
      .map(({ evidenceRecordId }) => evidenceRecordId)
      .sort(),
    sourceRefs: row.sourceRefs
      .map((ref) => ({
        kind: ref.sourceKind as "action" | "result" | "evidence",
        id: ref.sourceId,
        version: ref.sourceVersion,
      }))
      .sort((left, right) =>
        `${left.kind}\u0000${left.id}\u0000${left.version ?? ""}`.localeCompare(
          `${right.kind}\u0000${right.id}\u0000${right.version ?? ""}`,
        ),
      ),
  };
}

function scopeKey(scope: CollaborationScope): string {
  return [
    scope.tenantId,
    scope.subjectKind,
    scope.subjectId,
    scope.workKind,
    scope.workId,
    scope.visibilityScope,
  ]
    .map((value) => `${value.length}:${value}`)
    .join("|");
}

function prismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}
