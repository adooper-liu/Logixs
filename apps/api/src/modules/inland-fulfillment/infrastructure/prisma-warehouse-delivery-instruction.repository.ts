import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  WarehouseDeliveryInstructionConflictError,
  WarehouseDeliveryInstructionNotFoundError,
  type NormalizedWarehouseDeliveryInstructionCommand,
  type WarehouseDeliveryInstructionRecord,
} from "../domain/warehouse-delivery-instruction";
import type { WarehouseDeliveryInstructionRepository } from "../domain/warehouse-delivery-instruction.repository";

@Injectable()
export class PrismaWarehouseDeliveryInstructionRepository implements WarehouseDeliveryInstructionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<WarehouseDeliveryInstructionRecord | null> {
    const row = await this.prisma.warehouseDeliveryInstruction.findFirst({
      where: { ...input, state: "active" },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: instructionSelect,
    });
    return row ? toRecord(row, false) : null;
  }

  replace(
    command: NormalizedWarehouseDeliveryInstructionCommand,
  ): Promise<WarehouseDeliveryInstructionRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await acquireAdvisoryLocks(transaction, [
        `warehouse-delivery:container:${command.tenantId}:${command.containerRecordId}`,
        `warehouse-delivery:idempotency:${command.tenantId}:${command.idempotencyKey}`,
      ]);
      const existing =
        await transaction.warehouseDeliveryInstruction.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: command.tenantId,
              idempotencyKey: command.idempotencyKey,
            },
          },
          select: instructionSelect,
        });
      if (existing) {
        if (existing.payloadHash !== command.payloadHash) {
          throw new WarehouseDeliveryInstructionConflictError(
            "WAREHOUSE_DELIVERY_IDEMPOTENCY_CONFLICT",
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
        throw new WarehouseDeliveryInstructionNotFoundError(
          "RESOURCE_NOT_FOUND",
        );
      }
      const current = await transaction.warehouseDeliveryInstruction.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        throw new WarehouseDeliveryInstructionConflictError(
          "WAREHOUSE_DELIVERY_VERSION_CONFLICT",
        );
      }
      const now = new Date();
      if (current) {
        await transaction.warehouseDeliveryInstruction.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }
      const created = await transaction.warehouseDeliveryInstruction.create({
        data: {
          id: randomUUID(),
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          version: currentVersion + 1,
          state: "active",
          ...(current ? { supersedesInstructionId: current.id } : {}),
          warehouseLocationId: command.warehouseLocationId,
          warehouseCode: command.warehouseCode,
          warehouseName: command.warehouseName,
          unlocode: command.unlocode,
          timezone: command.timezone,
          appointmentStartAt: command.appointmentStartAt,
          appointmentEndAt: command.appointmentEndAt,
          appointmentReference: command.appointmentReference,
          ingestionChannel: command.ingestionChannel,
          sourceSystem: command.sourceSystem,
          evidenceRefs: command.evidenceRefs,
          actorId: command.actorId,
          reasonCode: command.reasonCode,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
        select: instructionSelect,
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

const instructionSelect = {
  id: true,
  containerRecordId: true,
  version: true,
  warehouseLocationId: true,
  warehouseCode: true,
  warehouseName: true,
  unlocode: true,
  timezone: true,
  appointmentStartAt: true,
  appointmentEndAt: true,
  appointmentReference: true,
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
    warehouseCode: string | null;
    warehouseName: string;
    unlocode: string | null;
    timezone: string;
    appointmentStartAt: Date | null;
    appointmentEndAt: Date | null;
    appointmentReference: string | null;
    evidenceRefs: unknown;
    actorId: string;
    reasonCode: string;
    createdAt: Date;
  },
  duplicate: boolean,
): WarehouseDeliveryInstructionRecord {
  if (
    !Array.isArray(row.evidenceRefs) ||
    !row.evidenceRefs.every((item) => typeof item === "string")
  ) {
    throw new Error("WAREHOUSE_DELIVERY_PERSISTENCE_CONTRACT_INVALID");
  }
  return {
    instructionId: row.id,
    containerRecordId: row.containerRecordId,
    version: row.version,
    warehouseLocationId: row.warehouseLocationId,
    warehouseCode: row.warehouseCode,
    warehouseName: row.warehouseName,
    unlocode: row.unlocode,
    timezone: row.timezone,
    appointmentStartAt: row.appointmentStartAt?.toISOString() ?? null,
    appointmentEndAt: row.appointmentEndAt?.toISOString() ?? null,
    appointmentReference: row.appointmentReference,
    evidenceRefs: row.evidenceRefs,
    actorId: row.actorId,
    reasonCode: row.reasonCode,
    createdAt: row.createdAt.toISOString(),
    duplicate,
  };
}
