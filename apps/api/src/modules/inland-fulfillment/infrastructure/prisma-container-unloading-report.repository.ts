import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ContainerUnloadingReportConflictError,
  ContainerUnloadingReportNotFoundError,
  assertUnloadingStateProgression,
  type ContainerUnloadingReportRecord,
  type NormalizedContainerUnloadingReportCommand,
  type UnloadingOperationState,
  type UnloadingQuantityUnit,
  type UnloadingSealCheck,
} from "../domain/container-unloading-report";
import type { ContainerUnloadingReportRepository } from "../domain/container-unloading-report.repository";

@Injectable()
export class PrismaContainerUnloadingReportRepository implements ContainerUnloadingReportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerUnloadingReportRecord | null> {
    const row = await this.prisma.containerUnloadingReport.findFirst({
      where: { ...input, state: "active" },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: reportSelect,
    });
    return row ? toRecord(row, false) : null;
  }

  append(
    command: NormalizedContainerUnloadingReportCommand,
  ): Promise<ContainerUnloadingReportRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await acquireAdvisoryLocks(transaction, [
        `container-unloading:container:${command.tenantId}:${command.containerRecordId}`,
        `container-unloading:idempotency:${command.tenantId}:${command.idempotencyKey}`,
      ]);
      const existing = await transaction.containerUnloadingReport.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: command.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
        select: reportSelect,
      });
      if (existing) {
        if (existing.payloadHash !== command.payloadHash) {
          throw new ContainerUnloadingReportConflictError(
            "CONTAINER_UNLOADING_IDEMPOTENCY_CONFLICT",
          );
        }
        return toRecord(existing, true);
      }

      const container = await transaction.containerRecord.findUnique({
        where: {
          id_tenantId: {
            id: command.containerRecordId,
            tenantId: command.tenantId,
          },
        },
        select: { id: true },
      });
      if (!container) {
        throw new ContainerUnloadingReportNotFoundError("RESOURCE_NOT_FOUND");
      }
      const current = await transaction.containerUnloadingReport.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
        },
        select: { id: true, version: true, operationState: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        throw new ContainerUnloadingReportConflictError(
          "CONTAINER_UNLOADING_VERSION_CONFLICT",
        );
      }
      assertUnloadingStateProgression(
        (current?.operationState as UnloadingOperationState | undefined) ??
          null,
        command.operationState,
      );
      const now = new Date();
      if (current) {
        await transaction.containerUnloadingReport.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }
      const created = await transaction.containerUnloadingReport.create({
        data: {
          id: randomUUID(),
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          version: currentVersion + 1,
          state: "active",
          ...(current ? { supersedesReportId: current.id } : {}),
          warehouseLocationId: command.warehouseLocationId,
          operationState: command.operationState,
          startedAt: command.startedAt,
          completedAt: command.completedAt,
          expectedQuantity: command.expectedQuantity,
          unloadedQuantity: command.unloadedQuantity,
          remainingQuantity: command.remainingQuantity,
          damagedQuantity: command.damagedQuantity,
          shortageQuantity: command.shortageQuantity,
          quantityUnit: command.quantityUnit,
          sealCheck: command.sealCheck,
          exceptionResolved: command.exceptionResolved,
          exceptionNotes: command.exceptionNotes,
          ingestionChannel: command.ingestionChannel,
          sourceSystem: command.sourceSystem,
          evidenceRefs: command.evidenceRefs,
          actorId: command.actorId,
          reasonCode: command.reasonCode,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
        select: reportSelect,
      });
      return toRecord(created, false);
    });
  }
}

async function acquireAdvisoryLocks(
  transaction: {
    $queryRaw(
      input: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<unknown>;
  },
  lockKeys: string[],
): Promise<void> {
  for (const lockKey of [...lockKeys].sort()) {
    await transaction.$queryRaw`
      SELECT 1 AS "lockAcquired"
      FROM (
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      ) AS acquired
    `;
  }
}

const reportSelect = {
  id: true,
  containerRecordId: true,
  version: true,
  warehouseLocationId: true,
  operationState: true,
  startedAt: true,
  completedAt: true,
  expectedQuantity: true,
  unloadedQuantity: true,
  remainingQuantity: true,
  damagedQuantity: true,
  shortageQuantity: true,
  quantityUnit: true,
  sealCheck: true,
  exceptionResolved: true,
  exceptionNotes: true,
  evidenceRefs: true,
  actorId: true,
  reasonCode: true,
  payloadHash: true,
  createdAt: true,
} as const;

function toRecord(
  row: {
    id: string;
    containerRecordId: string;
    version: number;
    warehouseLocationId: string;
    operationState: string;
    startedAt: Date;
    completedAt: Date | null;
    expectedQuantity: { toString(): string };
    unloadedQuantity: { toString(): string };
    remainingQuantity: { toString(): string };
    damagedQuantity: { toString(): string };
    shortageQuantity: { toString(): string };
    quantityUnit: string;
    sealCheck: string;
    exceptionResolved: boolean;
    exceptionNotes: string | null;
    evidenceRefs: unknown;
    actorId: string;
    reasonCode: string;
    createdAt: Date;
  },
  duplicate: boolean,
): ContainerUnloadingReportRecord {
  if (
    !Array.isArray(row.evidenceRefs) ||
    !row.evidenceRefs.every((item) => typeof item === "string")
  ) {
    throw new Error("CONTAINER_UNLOADING_PERSISTENCE_CONTRACT_INVALID");
  }
  return {
    reportId: row.id,
    containerRecordId: row.containerRecordId,
    version: row.version,
    warehouseLocationId: row.warehouseLocationId,
    operationState: row.operationState as UnloadingOperationState,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expectedQuantity: row.expectedQuantity.toString(),
    unloadedQuantity: row.unloadedQuantity.toString(),
    remainingQuantity: row.remainingQuantity.toString(),
    damagedQuantity: row.damagedQuantity.toString(),
    shortageQuantity: row.shortageQuantity.toString(),
    quantityUnit: row.quantityUnit as UnloadingQuantityUnit,
    sealCheck: row.sealCheck as UnloadingSealCheck,
    exceptionResolved: row.exceptionResolved,
    exceptionNotes: row.exceptionNotes,
    evidenceRefs: row.evidenceRefs as [string, ...string[]],
    actorId: row.actorId,
    reasonCode: row.reasonCode,
    createdAt: row.createdAt.toISOString(),
    duplicate,
  };
}
