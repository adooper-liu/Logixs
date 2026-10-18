import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  contextKeyOf,
  prepareWorkSessionActivation,
  WorkSessionConflictError,
} from "../domain/work-session";
import type {
  WorkSessionRecord,
  WorkSessionRepository,
} from "../domain/work-session.repository";

type Transaction = Prisma.TransactionClient;
type WorkSessionRow = Prisma.WorkSessionGetPayload<Record<string, never>>;

@Injectable()
export class PrismaWorkSessionRepository implements WorkSessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(input: Parameters<WorkSessionRepository["list"]>[0]) {
    const rows = await this.prisma.workSession.findMany({
      where: {
        tenantId: input.tenantId,
        ownerActorId: input.actorId,
        ...(input.includeClosed ? {} : { status: { not: "closed" } }),
        ...(input.after
          ? {
              OR: [
                { lastOpenedAt: { lt: input.after.lastOpenedAt } },
                {
                  lastOpenedAt: input.after.lastOpenedAt,
                  id: { lt: input.after.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ lastOpenedAt: "desc" }, { id: "desc" }],
      take: input.take,
    });
    return rows.map(toRecord);
  }

  async findById(tenantId: string, actorId: string, sessionId: string) {
    const row = await this.prisma.workSession.findFirst({
      where: { id: sessionId, tenantId, ownerActorId: actorId },
    });
    return row ? toRecord(row) : null;
  }

  async openOrFocus(
    input: Parameters<WorkSessionRepository["openOrFocus"]>[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await actorLock(tx, input.tenantId, input.actorId);
      const existing = await tx.workSession.findFirst({
        where: {
          tenantId: input.tenantId,
          ownerActorId: input.actorId,
          contextKey: input.contextKey,
          status: { not: "closed" },
        },
      });
      if (existing) return { record: toRecord(existing), created: false };

      const current = await tx.workSession.findFirst({
        where: {
          tenantId: input.tenantId,
          ownerActorId: input.actorId,
          status: "current",
        },
      });
      const now = new Date();
      const row = await tx.workSession.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          ownerActorId: input.actorId,
          version: 1,
          status: current ? "resumable" : "current",
          workbenchCode: input.workbenchCode,
          contextKind: input.routeContext.kind,
          contextKey: input.contextKey,
          subjectKind: input.subjectRef.kind,
          subjectId: input.subjectRef.id,
          taskKind: input.taskRef?.kind ?? null,
          taskId: input.taskRef?.id ?? null,
          draftKind: input.draftRef?.kind ?? null,
          draftId: input.draftRef?.id ?? null,
          draftVersion: input.draftRef?.version ?? null,
          domainVersionSeen: input.domainVersionSeen,
          activeItemKey: input.activeItemKey,
          contextMode: input.contextMode,
          displaySummary: input.displaySummary,
          lastOpenedAt: now,
          updatedAt: now,
        },
      });
      return { record: toRecord(row), created: true };
    });
  }

  async updatePointer(
    input: Parameters<WorkSessionRepository["updatePointer"]>[0],
  ) {
    const current = await this.requireOwned(input);
    if (current.version !== input.expectedVersion) conflict();
    if (current.status === "closed") {
      throw new WorkSessionConflictError("WORK_SESSION_CLOSED_TERMINAL");
    }
    const row = await this.prisma.workSession.update({
      where: { id: current.id },
      data: {
        version: { increment: 1 },
        ...(input.status ? { status: input.status } : {}),
        ...(input.draftRef !== undefined
          ? {
              draftKind: input.draftRef?.kind ?? null,
              draftId: input.draftRef?.id ?? null,
              draftVersion: input.draftRef?.version ?? null,
            }
          : {}),
        ...(input.domainVersionSeen !== undefined
          ? { domainVersionSeen: input.domainVersionSeen }
          : {}),
        ...(input.activeItemKey !== undefined
          ? { activeItemKey: input.activeItemKey }
          : {}),
        ...(input.contextMode !== undefined
          ? { contextMode: input.contextMode }
          : {}),
        ...(input.displaySummary !== undefined
          ? { displaySummary: input.displaySummary }
          : {}),
        updatedAt: new Date(),
      },
    });
    return toRecord(row);
  }

  async activate(input: Parameters<WorkSessionRepository["activate"]>[0]) {
    return this.prisma.$transaction(async (tx) => {
      await actorLock(tx, input.tenantId, input.actorId);
      const [source, target] = await Promise.all([
        tx.workSession.findFirst({
          where: {
            id: input.sourceSessionId,
            tenantId: input.tenantId,
            ownerActorId: input.actorId,
          },
        }),
        tx.workSession.findFirst({
          where: {
            id: input.targetSessionId,
            tenantId: input.tenantId,
            ownerActorId: input.actorId,
          },
        }),
      ]);
      if (!source || !target) notFound();
      if (source.id === target.id) {
        throw new WorkSessionConflictError("WORK_SESSION_SOURCE_TARGET_SAME");
      }
      if (source.status !== "current") {
        throw new WorkSessionConflictError("WORK_SESSION_SOURCE_NOT_CURRENT");
      }
      prepareWorkSessionActivation(
        {
          sourceVersion: source.version,
          targetVersion: target.version,
          targetStatus: target.status as WorkSessionRecord["status"],
        },
        {
          expectedSourceSessionVersion: input.expectedSourceVersion,
          expectedTargetSessionVersion: input.expectedTargetVersion,
          sourceStatus: input.sourceStatus,
          domainVersionSeen: input.targetDomainVersionSeen,
        },
      );
      if (target.domainVersionSeen !== input.targetDomainVersionSeen) {
        throw new WorkSessionConflictError(
          "WORK_SESSION_DOMAIN_VERSION_CONFLICT",
        );
      }
      const now = new Date();
      let sourceDraft: { id: string; draftVersion: number } | null = null;
      if (input.sourceStatus === "draft_saved") {
        if (source.contextKind !== "product_selection.v1") {
          throw new WorkSessionConflictError(
            "WORK_SESSION_DRAFT_STATUS_UNSUPPORTED",
          );
        }
        sourceDraft = await tx.productInitiativeDecisionDraft.findFirst({
          where: {
            tenantId: input.tenantId,
            handoffId: source.subjectId,
          },
          select: { id: true, draftVersion: true },
        });
        if (!sourceDraft) {
          throw new WorkSessionConflictError(
            "WORK_SESSION_DOMAIN_DRAFT_NOT_FOUND",
          );
        }
      }
      const updatedSource = await tx.workSession.update({
        where: { id: source.id },
        data: {
          version: { increment: 1 },
          status: input.sourceStatus,
          domainVersionSeen: input.sourceDomainVersionSeen,
          activeItemKey: input.sourceActiveItemKey,
          contextMode: input.sourceContextMode,
          draftKind: sourceDraft
            ? "product_initiative_decision_draft"
            : source.draftKind,
          draftId: sourceDraft?.id ?? source.draftId,
          draftVersion: sourceDraft?.draftVersion ?? source.draftVersion,
          updatedAt: now,
        },
      });
      const updatedTarget = await tx.workSession.update({
        where: { id: target.id },
        data: {
          version: { increment: 1 },
          status: "current",
          lastOpenedAt: now,
          updatedAt: now,
        },
      });
      return {
        source: toRecord(updatedSource),
        target: toRecord(updatedTarget),
      };
    });
  }

  async close(input: Parameters<WorkSessionRepository["close"]>[0]) {
    const current = await this.requireOwned(input);
    if (current.version !== input.expectedVersion) conflict();
    if (current.status === "current") {
      throw new WorkSessionConflictError(
        "WORK_SESSION_CURRENT_CLOSE_REQUIRES_SWITCH",
      );
    }
    if (current.status === "browser_held") {
      throw new WorkSessionConflictError(
        "WORK_SESSION_BROWSER_HELD_CLOSE_REQUIRES_ORIGINAL_TAB",
      );
    }
    if (current.status === "closed") {
      throw new WorkSessionConflictError("WORK_SESSION_CLOSED_TERMINAL");
    }
    const row = await this.prisma.workSession.update({
      where: { id: current.id },
      data: {
        version: { increment: 1 },
        status: "closed",
        updatedAt: new Date(),
      },
    });
    return toRecord(row);
  }

  private async requireOwned(input: {
    tenantId: string;
    actorId: string;
    sessionId: string;
  }): Promise<WorkSessionRow> {
    const row = await this.prisma.workSession.findFirst({
      where: {
        id: input.sessionId,
        tenantId: input.tenantId,
        ownerActorId: input.actorId,
      },
    });
    if (!row) notFound();
    return row;
  }
}

function toRecord(row: WorkSessionRow): WorkSessionRecord {
  const routeContext =
    row.contextKind === "product_selection.v1"
      ? { kind: "product_selection.v1" as const, handoffId: row.subjectId }
      : {
          kind: "stuffing.v1" as const,
          containerId: row.subjectId,
          taskId: row.taskId!,
        };
  const subjectRef =
    row.subjectKind === "product_initiative_handoff"
      ? { kind: "product_initiative_handoff" as const, id: row.subjectId }
      : { kind: "container" as const, id: row.subjectId };
  return {
    sessionId: row.id,
    version: row.version,
    status: row.status as WorkSessionRecord["status"],
    workbenchCode: row.workbenchCode as WorkSessionRecord["workbenchCode"],
    contextKey: contextKeyOf(routeContext),
    routeContext,
    subjectRef,
    taskRef: row.taskId ? { kind: "node_task", id: row.taskId } : null,
    draftRef:
      row.draftId && row.draftVersion
        ? {
            kind: "product_initiative_decision_draft",
            id: row.draftId,
            version: row.draftVersion,
          }
        : null,
    domainVersionSeen: row.domainVersionSeen,
    activeItemKey: row.activeItemKey,
    contextMode: row.contextMode,
    displaySummary: row.displaySummary,
    lastOpenedAt: row.lastOpenedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function actorLock(
  tx: Transaction,
  tenantId: string,
  actorId: string,
): Promise<void> {
  const key = `work-session:${tenantId}:${actorId}`;
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS acquired
  `;
}

function notFound(): never {
  throw new NotFoundException("WORK_SESSION_NOT_FOUND");
}

function conflict(): never {
  throw new WorkSessionConflictError("WORK_SESSION_VERSION_CONFLICT");
}
