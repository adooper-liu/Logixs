import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ContainerCargoAllocationConflictError,
  ContainerCargoAllocationNotFoundError,
  quantityToScaledInteger,
  type ContainerCargoAllocationResult,
  type NormalizedReplaceContainerCargoAllocationsCommand,
} from "../domain/container-cargo-allocation";
import type { ContainerCargoAllocationRepository } from "../domain/container-cargo-allocation.repository";
import type { ContainerCargoComplianceScope } from "../get-container-cargo-compliance-scope.port";

@Injectable()
export class PrismaContainerCargoAllocationRepository implements ContainerCargoAllocationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findActiveComplianceScope(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerCargoComplianceScope | null> {
    const active = await this.prisma.containerCargoAllocationSet.findFirst({
      where: {
        tenantId: input.tenantId,
        containerRecordId: input.containerRecordId,
        state: "active",
      },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: {
        id: true,
        containerRecordId: true,
        version: true,
        allocations: {
          where: { replenishmentOrderLineId: { not: null } },
          orderBy: [
            { replenishmentOrderLine: { productNumber: "asc" } },
            { replenishmentOrderLineId: "asc" },
          ],
          select: {
            replenishmentOrderLineId: true,
            allocatedQuantity: true,
            quantityUnit: true,
            replenishmentOrderLine: {
              select: { productSkuId: true, productNumber: true },
            },
          },
        },
      },
    });
    if (!active) return null;

    const items = active.allocations.map((allocation) => {
      if (
        !allocation.replenishmentOrderLineId ||
        !allocation.replenishmentOrderLine
      ) {
        throw new Error("REPLENISHMENT_ORDER_LINE_REFERENCE_MISSING");
      }
      if (!allocation.replenishmentOrderLine.productSkuId) {
        throw new Error("REPLENISHMENT_ORDER_LINE_SKU_UNBOUND");
      }
      return {
        replenishmentOrderLineId: allocation.replenishmentOrderLineId,
        productSkuId: allocation.replenishmentOrderLine.productSkuId,
        productNumber: allocation.replenishmentOrderLine.productNumber,
        allocatedQuantity: allocation.allocatedQuantity.toString(),
        quantityUnit: allocation.quantityUnit,
      };
    });
    return {
      containerRecordId: active.containerRecordId,
      allocationSetId: active.id,
      allocationSetVersion: active.version,
      items,
    };
  }

  replace(
    command: NormalizedReplaceContainerCargoAllocationsCommand,
  ): Promise<ContainerCargoAllocationResult> {
    return this.prisma.$transaction(async (transaction) => {
      await acquireAdvisoryLocks(transaction, [
        `cargo-allocation:container:${command.tenantId}:${command.containerRecordId}`,
        `cargo-allocation:idempotency:${command.tenantId}:${command.idempotencyKey}`,
      ]);

      const existing = await transaction.containerCargoAllocationSet.findUnique(
        {
          where: {
            tenantId_idempotencyKey: {
              tenantId: command.tenantId,
              idempotencyKey: command.idempotencyKey,
            },
          },
          select: {
            id: true,
            containerRecordId: true,
            version: true,
            payloadHash: true,
            _count: { select: { allocations: true } },
          },
        },
      );
      if (existing) {
        if (existing.payloadHash !== command.payloadHash) {
          throw new ContainerCargoAllocationConflictError(
            "CARGO_ALLOCATION_IDEMPOTENCY_CONFLICT",
          );
        }
        return {
          allocationSetId: existing.id,
          containerRecordId: existing.containerRecordId,
          version: existing.version,
          allocationCount: existing._count.allocations,
          duplicate: true,
        };
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
        throw new ContainerCargoAllocationNotFoundError(
          "CONTAINER_RECORD_NOT_FOUND",
        );
      }

      const current = await transaction.containerCargoAllocationSet.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        throw new ContainerCargoAllocationConflictError(
          "CARGO_ALLOCATION_VERSION_CONFLICT",
        );
      }

      const lineIds = command.allocations.map(
        ({ replenishmentOrderLineId }) => replenishmentOrderLineId,
      );
      for (const lineId of lineIds) {
        await transaction.$queryRaw`
          SELECT "id"
          FROM "replenishment_order_line"
          WHERE "id" = ${lineId} AND "tenant_id" = ${command.tenantId}
          FOR UPDATE
        `;
      }
      const lines = await transaction.replenishmentOrderLine.findMany({
        where: {
          tenantId: command.tenantId,
          id: { in: lineIds },
        },
        select: {
          id: true,
          productSkuId: true,
          shippedQuantity: true,
          quantityUnit: true,
          isCurrent: true,
        },
      });
      if (lines.length !== lineIds.length) {
        throw new ContainerCargoAllocationNotFoundError(
          "REPLENISHMENT_ORDER_LINE_NOT_FOUND",
        );
      }
      const linesById = new Map(lines.map((line) => [line.id, line]));
      for (const allocation of command.allocations) {
        const line = linesById.get(allocation.replenishmentOrderLineId);
        if (!line) {
          throw new ContainerCargoAllocationNotFoundError(
            "REPLENISHMENT_ORDER_LINE_NOT_FOUND",
          );
        }
        if (!line.isCurrent) {
          throw new ContainerCargoAllocationConflictError(
            "REPLENISHMENT_ORDER_LINE_NOT_CURRENT",
          );
        }
        if (!line.productSkuId) {
          throw new ContainerCargoAllocationConflictError(
            "REPLENISHMENT_ORDER_LINE_SKU_UNBOUND",
          );
        }
        if (line.quantityUnit !== allocation.quantityUnit) {
          throw new ContainerCargoAllocationConflictError(
            "CARGO_ALLOCATION_QUANTITY_UNIT_MISMATCH",
          );
        }
      }

      const activeAllocations =
        await transaction.containerCargoAllocation.findMany({
          where: {
            tenantId: command.tenantId,
            replenishmentOrderLineId: { in: lineIds },
            allocationSet: {
              state: "active",
              containerRecordId: { not: command.containerRecordId },
            },
          },
          select: {
            replenishmentOrderLineId: true,
            allocatedQuantity: true,
          },
        });
      const usedByLine = new Map<string, bigint>();
      for (const allocation of activeAllocations) {
        if (!allocation.replenishmentOrderLineId) {
          throw new ContainerCargoAllocationConflictError(
            "REPLENISHMENT_ORDER_LINE_REFERENCE_MISSING",
          );
        }
        usedByLine.set(
          allocation.replenishmentOrderLineId,
          (usedByLine.get(allocation.replenishmentOrderLineId) ?? 0n) +
            quantityToScaledInteger(allocation.allocatedQuantity.toString()),
        );
      }
      for (const allocation of command.allocations) {
        const line = linesById.get(allocation.replenishmentOrderLineId)!;
        const total =
          (usedByLine.get(allocation.replenishmentOrderLineId) ?? 0n) +
          quantityToScaledInteger(allocation.allocatedQuantity);
        if (total > quantityToScaledInteger(line.shippedQuantity.toString())) {
          throw new ContainerCargoAllocationConflictError(
            "CARGO_ALLOCATION_EXCEEDS_SHIPPED_QUANTITY",
          );
        }
      }

      const now = new Date();
      if (current) {
        await transaction.containerCargoAllocationSet.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }
      const allocationSetId = randomUUID();
      const created = await transaction.containerCargoAllocationSet.create({
        data: {
          id: allocationSetId,
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          version: currentVersion + 1,
          state: "active",
          ...(current ? { supersedesSetId: current.id } : {}),
          ingestionChannel: command.ingestionChannel,
          sourceSystem: command.sourceSystem,
          evidenceRefs: command.evidenceRefs,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
        select: {
          id: true,
          containerRecordId: true,
          version: true,
        },
      });
      await transaction.containerCargoAllocation.createMany({
        data: command.allocations.map((allocation) => ({
          id: randomUUID(),
          tenantId: command.tenantId,
          allocationSetId: created.id,
          replenishmentOrderLineId: allocation.replenishmentOrderLineId,
          allocatedQuantity: allocation.allocatedQuantity,
          quantityUnit: allocation.quantityUnit,
        })),
      });
      return {
        allocationSetId: created.id,
        containerRecordId: created.containerRecordId,
        version: created.version,
        allocationCount: command.allocations.length,
        duplicate: false,
      };
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
