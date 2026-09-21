import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ContainerDispatchSnapshotConflictError,
  ContainerDispatchSnapshotNotFoundError,
  type ContainerDispatchSnapshotRecord,
  type NormalizedContainerDispatchSnapshotCommand,
} from "../domain/container-dispatch-snapshot";
import type { ContainerDispatchSnapshotRepository } from "../domain/container-dispatch-snapshot.repository";

@Injectable()
export class PrismaContainerDispatchSnapshotRepository implements ContainerDispatchSnapshotRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerDispatchSnapshotRecord | null> {
    const row = await this.prisma.containerDispatchSnapshot.findFirst({
      where: { ...input, state: "active" },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: dispatchSelect,
    });
    return row ? toRecord(row, false) : null;
  }

  replace(
    command: NormalizedContainerDispatchSnapshotCommand,
  ): Promise<ContainerDispatchSnapshotRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await acquireAdvisoryLocks(transaction, [
        `container-dispatch:container:${command.tenantId}:${command.containerRecordId}`,
        `container-dispatch:idempotency:${command.tenantId}:${command.idempotencyKey}`,
      ]);
      const existing = await transaction.containerDispatchSnapshot.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: command.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
        select: dispatchSelect,
      });
      if (existing) {
        if (existing.payloadHash !== command.payloadHash) {
          throw new ContainerDispatchSnapshotConflictError(
            "CONTAINER_DISPATCH_IDEMPOTENCY_CONFLICT",
          );
        }
        return toRecord(existing, true);
      }

      const stuffing = await transaction.containerStuffingSnapshot.findFirst({
        where: {
          id: command.stuffingSnapshotId,
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
          version: command.stuffingSnapshotVersion,
        },
        select: {
          id: true,
          vgmWeight: true,
          vgmWeightUnit: true,
          vgmMethod: true,
          vgmVerifiedAt: true,
        },
      });
      if (!stuffing) {
        throw new ContainerDispatchSnapshotNotFoundError(
          "CONTAINER_DISPATCH_STUFFING_SNAPSHOT_NOT_CURRENT",
        );
      }
      if (
        !stuffing.vgmWeight ||
        stuffing.vgmWeightUnit !== "KGM" ||
        !stuffing.vgmMethod ||
        !stuffing.vgmVerifiedAt
      ) {
        throw new ContainerDispatchSnapshotConflictError(
          "CONTAINER_DISPATCH_VGM_NOT_AVAILABLE",
        );
      }
      const current = await transaction.containerDispatchSnapshot.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        throw new ContainerDispatchSnapshotConflictError(
          "CONTAINER_DISPATCH_VERSION_CONFLICT",
        );
      }
      const now = new Date();
      if (current) {
        await transaction.containerDispatchSnapshot.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }
      const created = await transaction.containerDispatchSnapshot.create({
        data: {
          id: randomUUID(),
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          version: currentVersion + 1,
          state: "active",
          ...(current ? { supersedesSnapshotId: current.id } : {}),
          stuffingSnapshotId: command.stuffingSnapshotId,
          stuffingSnapshotVersion: command.stuffingSnapshotVersion,
          bookingNumber: command.bookingNumber,
          carrierCode: command.carrierCode,
          vesselName: command.vesselName,
          voyageNumber: command.voyageNumber,
          masterBillNumber: command.masterBillNumber,
          houseBillNumber: command.houseBillNumber,
          vgmHandoffState: command.vgmHandoffState,
          ingestionChannel: command.ingestionChannel,
          sourceSystem: command.sourceSystem,
          evidenceRefs: command.evidenceRefs,
          actorId: command.actorId,
          reasonCode: command.reasonCode,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
        select: dispatchSelect,
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

const dispatchSelect = {
  id: true,
  containerRecordId: true,
  version: true,
  stuffingSnapshotId: true,
  stuffingSnapshotVersion: true,
  bookingNumber: true,
  carrierCode: true,
  vesselName: true,
  voyageNumber: true,
  masterBillNumber: true,
  houseBillNumber: true,
  vgmHandoffState: true,
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
    stuffingSnapshotId: string;
    stuffingSnapshotVersion: number;
    bookingNumber: string;
    carrierCode: string;
    vesselName: string;
    voyageNumber: string;
    masterBillNumber: string | null;
    houseBillNumber: string | null;
    vgmHandoffState: string;
    evidenceRefs: unknown;
    actorId: string;
    reasonCode: string;
    createdAt: Date;
  },
  duplicate: boolean,
): ContainerDispatchSnapshotRecord {
  if (
    row.vgmHandoffState !== "accepted" ||
    !Array.isArray(row.evidenceRefs) ||
    !row.evidenceRefs.every((item) => typeof item === "string")
  ) {
    throw new Error("CONTAINER_DISPATCH_PERSISTENCE_CONTRACT_INVALID");
  }
  return {
    snapshotId: row.id,
    containerRecordId: row.containerRecordId,
    version: row.version,
    stuffingSnapshotId: row.stuffingSnapshotId,
    stuffingSnapshotVersion: row.stuffingSnapshotVersion,
    bookingNumber: row.bookingNumber,
    carrierCode: row.carrierCode,
    vesselName: row.vesselName,
    voyageNumber: row.voyageNumber,
    masterBillNumber: row.masterBillNumber,
    houseBillNumber: row.houseBillNumber,
    vgmHandoffState: "accepted",
    evidenceRefs: row.evidenceRefs,
    actorId: row.actorId,
    reasonCode: row.reasonCode,
    createdAt: row.createdAt.toISOString(),
    duplicate,
  };
}
