import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ContainerStuffingSnapshotConflictError,
  ContainerStuffingSnapshotNotFoundError,
  type ContainerStuffingSnapshotRecord,
  type NormalizedContainerStuffingSnapshotCommand,
  type VgmMethod,
} from "../domain/container-stuffing-snapshot";
import type { ContainerStuffingSnapshotRepository } from "../domain/container-stuffing-snapshot.repository";

@Injectable()
export class PrismaContainerStuffingSnapshotRepository implements ContainerStuffingSnapshotRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerStuffingSnapshotRecord | null> {
    const row = await this.prisma.containerStuffingSnapshot.findFirst({
      where: {
        tenantId: input.tenantId,
        containerRecordId: input.containerRecordId,
        state: "active",
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: snapshotSelect,
    });
    return row ? toRecord(row, false) : null;
  }

  replace(
    command: NormalizedContainerStuffingSnapshotCommand,
  ): Promise<ContainerStuffingSnapshotRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await acquireAdvisoryLocks(transaction, [
        `cargo-allocation:container:${command.tenantId}:${command.containerRecordId}`,
        `container-stuffing:idempotency:${command.tenantId}:${command.idempotencyKey}`,
      ]);

      const existing = await transaction.containerStuffingSnapshot.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: command.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
        select: snapshotSelect,
      });
      if (existing) {
        if (existing.payloadHash !== command.payloadHash) {
          throw new ContainerStuffingSnapshotConflictError(
            "CONTAINER_STUFFING_IDEMPOTENCY_CONFLICT",
          );
        }
        return toRecord(existing, true);
      }

      await transaction.$queryRaw`
        SELECT "id"
        FROM "container_record"
        WHERE "id" = ${command.containerRecordId}
          AND "tenant_id" = ${command.tenantId}
        FOR UPDATE
      `;
      const container = await transaction.containerRecord.findUnique({
        where: {
          id_tenantId: {
            id: command.containerRecordId,
            tenantId: command.tenantId,
          },
        },
        select: { id: true, containerNumber: true },
      });
      if (!container) {
        throw new ContainerStuffingSnapshotNotFoundError(
          "CONTAINER_RECORD_NOT_FOUND",
        );
      }
      if (
        container.containerNumber &&
        container.containerNumber.toUpperCase() !== command.containerNumber
      ) {
        throw new ContainerStuffingSnapshotConflictError(
          "CONTAINER_STUFFING_IDENTITY_CONFLICT",
        );
      }

      const allocation =
        await transaction.containerCargoAllocationSet.findFirst({
          where: {
            tenantId: command.tenantId,
            containerRecordId: command.containerRecordId,
            state: "active",
          },
          select: { id: true, version: true },
        });
      if (!allocation) {
        throw new ContainerStuffingSnapshotNotFoundError(
          "CONTAINER_STUFFING_ALLOCATION_NOT_FOUND",
        );
      }
      if (
        allocation.id !== command.allocationSetId ||
        allocation.version !== command.allocationSetVersion
      ) {
        throw new ContainerStuffingSnapshotConflictError(
          "CONTAINER_STUFFING_ALLOCATION_VERSION_CONFLICT",
        );
      }

      const current = await transaction.containerStuffingSnapshot.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        throw new ContainerStuffingSnapshotConflictError(
          "CONTAINER_STUFFING_VERSION_CONFLICT",
        );
      }

      const now = new Date();
      if (current) {
        await transaction.containerStuffingSnapshot.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }
      if (!container.containerNumber) {
        await transaction.containerRecord.update({
          where: {
            id_tenantId: {
              id: command.containerRecordId,
              tenantId: command.tenantId,
            },
          },
          data: { containerNumber: command.containerNumber },
        });
      }

      const created = await transaction.containerStuffingSnapshot.create({
        data: {
          id: randomUUID(),
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          version: currentVersion + 1,
          state: "active",
          ...(current ? { supersedesSnapshotId: current.id } : {}),
          allocationSetId: command.allocationSetId,
          allocationSetVersion: command.allocationSetVersion,
          containerNumber: command.containerNumber,
          sealNumber: command.sealNumber,
          packageCount: command.packageCount,
          grossWeight: command.grossWeight,
          grossWeightUnit: command.grossWeightUnit,
          netWeight: command.netWeight,
          volume: command.volume,
          volumeUnit: command.volumeUnit,
          vgmWeight: command.vgm?.weight ?? null,
          vgmWeightUnit: command.vgm?.weightUnit ?? null,
          vgmMethod: command.vgm?.method ?? null,
          vgmVerifiedAt: command.vgm ? new Date(command.vgm.verifiedAt) : null,
          ingestionChannel: command.ingestionChannel,
          sourceSystem: command.sourceSystem,
          evidenceRefs: command.evidenceRefs,
          actorId: command.actorId,
          reasonCode: command.reasonCode,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
        select: snapshotSelect,
      });
      return toRecord(created, false);
    });
  }
}

const snapshotSelect = {
  id: true,
  containerRecordId: true,
  version: true,
  allocationSetId: true,
  allocationSetVersion: true,
  containerNumber: true,
  sealNumber: true,
  packageCount: true,
  grossWeight: true,
  grossWeightUnit: true,
  netWeight: true,
  volume: true,
  volumeUnit: true,
  vgmWeight: true,
  vgmWeightUnit: true,
  vgmMethod: true,
  vgmVerifiedAt: true,
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
    allocationSetId: string;
    allocationSetVersion: number;
    containerNumber: string;
    sealNumber: string;
    packageCount: number;
    grossWeight: { toString(): string };
    grossWeightUnit: string;
    netWeight: { toString(): string } | null;
    volume: { toString(): string };
    volumeUnit: string;
    vgmWeight: { toString(): string } | null;
    vgmWeightUnit: string | null;
    vgmMethod: string | null;
    vgmVerifiedAt: Date | null;
    evidenceRefs: unknown;
    actorId: string;
    reasonCode: string;
    createdAt: Date;
  },
  duplicate: boolean,
): ContainerStuffingSnapshotRecord {
  const evidenceRefs = stringArray(row.evidenceRefs);
  const vgm =
    row.vgmWeight &&
    row.vgmWeightUnit === "KGM" &&
    (row.vgmMethod === "method_1" || row.vgmMethod === "method_2") &&
    row.vgmVerifiedAt
      ? {
          weight: row.vgmWeight.toString(),
          weightUnit: "KGM" as const,
          method: row.vgmMethod as VgmMethod,
          verifiedAt: row.vgmVerifiedAt.toISOString(),
        }
      : null;
  if (row.grossWeightUnit !== "KGM" || row.volumeUnit !== "MTQ") {
    throw new Error("CONTAINER_STUFFING_PERSISTENCE_CONTRACT_INVALID");
  }
  return {
    snapshotId: row.id,
    containerRecordId: row.containerRecordId,
    version: row.version,
    allocationSetId: row.allocationSetId,
    allocationSetVersion: row.allocationSetVersion,
    containerNumber: row.containerNumber,
    sealNumber: row.sealNumber,
    packageCount: row.packageCount,
    grossWeight: row.grossWeight.toString(),
    grossWeightUnit: "KGM",
    netWeight: row.netWeight?.toString() ?? null,
    volume: row.volume.toString(),
    volumeUnit: "MTQ",
    vgm,
    evidenceRefs,
    actorId: row.actorId,
    reasonCode: row.reasonCode,
    createdAt: row.createdAt.toISOString(),
    duplicate,
  };
}

function stringArray(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error("CONTAINER_STUFFING_PERSISTENCE_CONTRACT_INVALID");
  }
  return value;
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
