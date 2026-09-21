import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type { NormalizedExternalWorkItemProjection } from "../domain/external-work-item";
import {
  ExternalWorkItemConflictError,
  type ExternalWorkItemRecord,
  type ExternalWorkItemRepository,
} from "../domain/external-work-item.repository";

@Injectable()
export class PrismaExternalWorkItemRepository implements ExternalWorkItemRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceProjection(input: NormalizedExternalWorkItemProjection) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`external-work-item:${input.tenantId}:${input.sourceModule}:${input.sourceScopeId}`})
        )
      `;
      const current = await transaction.externalWorkItemProjection.findUnique({
        where: {
          tenantId_sourceModule_sourceScopeId: {
            tenantId: input.tenantId,
            sourceModule: input.sourceModule,
            sourceScopeId: input.sourceScopeId,
          },
        },
      });
      if (current) {
        if (current.sourceVersion > input.sourceVersion) {
          throw new ExternalWorkItemConflictError(
            "EXTERNAL_WORK_ITEM_PROJECTION_STALE",
          );
        }
        if (current.sourceVersion === input.sourceVersion) {
          if (
            current.sourceRecordId !== input.sourceRecordId ||
            current.payloadHash !== input.projectionHash
          ) {
            throw new ExternalWorkItemConflictError(
              "EXTERNAL_WORK_ITEM_PROJECTION_CONFLICT",
            );
          }
          return {
            items: await listProjectionItems(transaction, input),
            created: 0,
            cancelled: 0,
            duplicate: true,
          };
        }
      }

      const now = new Date();
      const cancelled = await transaction.externalWorkItem.updateMany({
        where: {
          tenantId: input.tenantId,
          sourceModule: input.sourceModule,
          sourceScopeId: input.sourceScopeId,
          state: "open",
        },
        data: { state: "cancelled", closedAt: now },
      });
      if (input.items.length > 0) {
        await transaction.externalWorkItem.createMany({
          data: input.items.map((item) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            sourceModule: input.sourceModule,
            sourceType: input.sourceType,
            sourceScopeId: input.sourceScopeId,
            sourceRecordId: input.sourceRecordId,
            sourceVersion: input.sourceVersion,
            sourceItemKey: item.sourceItemKey,
            containerId: input.containerId,
            taskDefinitionKey: item.taskDefinitionKey,
            title: item.title,
            detail: item.detail,
            priority: item.priority,
            state: "open",
            assignedRoleCode: item.assignedRoleCode,
            evidenceRefs: item.evidenceRefs,
            dueAt: item.dueAt,
            payloadHash: item.payloadHash,
          })),
        });
      }
      await transaction.externalWorkItemProjection.upsert({
        where: {
          tenantId_sourceModule_sourceScopeId: {
            tenantId: input.tenantId,
            sourceModule: input.sourceModule,
            sourceScopeId: input.sourceScopeId,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: input.tenantId,
          sourceModule: input.sourceModule,
          sourceType: input.sourceType,
          sourceScopeId: input.sourceScopeId,
          sourceRecordId: input.sourceRecordId,
          sourceVersion: input.sourceVersion,
          payloadHash: input.projectionHash,
        },
        update: {
          sourceType: input.sourceType,
          sourceRecordId: input.sourceRecordId,
          sourceVersion: input.sourceVersion,
          payloadHash: input.projectionHash,
        },
      });
      return {
        items: await listProjectionItems(transaction, input),
        created: input.items.length,
        cancelled: cancelled.count,
        duplicate: false,
      };
    });
  }

  async listOpen(input: {
    tenantId: string;
    containerId?: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ExternalWorkItemRecord[]> {
    const rows = await this.prisma.externalWorkItem.findMany({
      where: {
        tenantId: input.tenantId,
        state: "open",
        ...(input.containerId ? { containerId: input.containerId } : {}),
        ...(input.after
          ? {
              OR: [
                { createdAt: { gt: input.after.createdAt } },
                {
                  AND: [
                    { createdAt: input.after.createdAt },
                    { id: { gt: input.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.take,
    });
    return rows.map(toRecord);
  }
}

async function listProjectionItems(
  transaction: Prisma.TransactionClient,
  input: Pick<
    NormalizedExternalWorkItemProjection,
    "tenantId" | "sourceModule" | "sourceRecordId"
  >,
): Promise<ExternalWorkItemRecord[]> {
  const rows = await transaction.externalWorkItem.findMany({
    where: {
      tenantId: input.tenantId,
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
    },
    orderBy: [{ sourceItemKey: "asc" }, { id: "asc" }],
  });
  return rows.map(toRecord);
}

function toRecord(row: {
  id: string;
  tenantId: string;
  sourceModule: string;
  sourceType: string;
  sourceScopeId: string;
  sourceRecordId: string;
  sourceVersion: number;
  sourceItemKey: string;
  containerId: string;
  taskDefinitionKey: string;
  title: string;
  detail: string;
  priority: string;
  state: string;
  assignedRoleCode: string;
  evidenceRefs: unknown;
  dueAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ExternalWorkItemRecord {
  return {
    ...row,
    priority: row.priority as ExternalWorkItemRecord["priority"],
    state: row.state as ExternalWorkItemRecord["state"],
    evidenceRefs: Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}
