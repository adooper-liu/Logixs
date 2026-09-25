import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ShipmentPendingCargoCompletionConflictError,
  ShipmentPendingCargoCompletionNotFoundError,
  type CompleteShipmentPendingCargoInput,
  type CompleteShipmentPendingCargoOutput,
  type ShipmentPendingCargoCompletionPort,
} from "../shipment-pending-cargo-completion.port";

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PrismaShipmentPendingCargoCompletion implements ShipmentPendingCargoCompletionPort {
  constructor(private readonly prisma: PrismaService) {}

  async complete(
    input: CompleteShipmentPendingCargoInput,
  ): Promise<CompleteShipmentPendingCargoOutput> {
    const payloadHash = hashCommand(input.command);
    return this.prisma.$transaction(async (tx) => {
      await acquireLock(
        tx,
        `shipment-pending-cargo:${input.tenantId}:${input.command.idempotencyKey}`,
      );
      const replay = await tx.shipmentHandoffRecord.findFirst({
        where: {
          tenantId: input.tenantId,
          idempotencyKey: input.command.idempotencyKey,
        },
        select: {
          shipmentId: true,
          sourceSystem: true,
          payloadHash: true,
          traceId: true,
          cargoLines: { select: { productSkuId: true } },
        },
      });
      if (replay) {
        if (
          replay.shipmentId !== input.shipmentId ||
          replay.sourceSystem !== "logix.operator_cargo_completion" ||
          replay.payloadHash !== payloadHash
        ) {
          throw new ShipmentPendingCargoCompletionConflictError(
            "IDEMPOTENCY_PAYLOAD_CONFLICT",
          );
        }
        return {
          duplicate: true,
          relationshipVersion: input.command.expectedRelationshipVersion,
          cargoLineCount: replay.cargoLines.length,
          unmatchedSkuCount: replay.cargoLines.filter(
            ({ productSkuId }) => !productSkuId,
          ).length,
          traceId: replay.traceId,
        };
      }

      await acquireLock(
        tx,
        `shipment-pending-cargo:${input.tenantId}:${input.shipmentId}`,
      );
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, tenantId: input.tenantId },
        select: {
          relationshipVersion: true,
          containerLinks: {
            where: { state: "active", supersededAt: null },
            select: { containerRecordId: true },
          },
          cargoLines: {
            select: { id: true },
          },
        },
      });
      if (!shipment) {
        throw new ShipmentPendingCargoCompletionNotFoundError(
          "SHIPMENT_NOT_FOUND",
        );
      }
      if (
        shipment.relationshipVersion !==
        input.command.expectedRelationshipVersion
      ) {
        throw new ShipmentPendingCargoCompletionConflictError(
          "TARGET_SHIPMENT_VERSION_CONFLICT",
        );
      }
      if (shipment.cargoLines.length > 0) {
        throw new ShipmentPendingCargoCompletionConflictError(
          "SHIPMENT_CARGO_CORRECTION_REQUIRED",
        );
      }

      const activeContainerIds = new Set(
        shipment.containerLinks.map(({ containerRecordId }) =>
          containerRecordId.toLowerCase(),
        ),
      );
      const requestedContainerIds = [
        ...new Set(
          input.command.lines.map(({ containerRecordId }) =>
            containerRecordId.toLowerCase(),
          ),
        ),
      ];
      if (
        requestedContainerIds.some(
          (containerRecordId) => !activeContainerIds.has(containerRecordId),
        )
      ) {
        throw new ShipmentPendingCargoCompletionConflictError(
          "SHIPMENT_CONTAINER_REFERENCE_INVALID",
        );
      }
      const existingAllocationSet =
        await tx.containerCargoAllocationSet.findFirst({
          where: {
            tenantId: input.tenantId,
            containerRecordId: { in: requestedContainerIds },
          },
          select: { id: true },
        });
      if (existingAllocationSet) {
        throw new ShipmentPendingCargoCompletionConflictError(
          "CONTAINER_CARGO_CORRECTION_REQUIRED",
        );
      }

      const handoffId = randomUUID();
      const digest = createHash("sha256")
        .update(
          `${input.tenantId}:${input.shipmentId}:${input.command.idempotencyKey}`,
        )
        .digest("hex");
      await tx.shipmentHandoffRecord.create({
        data: {
          id: handoffId,
          tenantId: input.tenantId,
          sourceProfile: "api_v1",
          ingestionChannel: "manual",
          sourceSystem: "logix.operator_cargo_completion",
          externalHandoffId: `shipment-cargo-completion:${input.shipmentId}:${digest.slice(0, 32)}`,
          handoffVersion: 1,
          occurredAt: new Date(input.command.occurredAt),
          idempotencyKey: input.command.idempotencyKey,
          payloadHash,
          payloadJson: input.command as unknown as Prisma.InputJsonValue,
          status: "accepted",
          shipmentId: input.shipmentId,
          actorId: input.actorId,
          traceId: input.traceId,
        },
      });

      const lineIds = input.command.lines.map(() => randomUUID());
      await tx.shipmentCargoLine.createMany({
        data: input.command.lines.map((line, index) => ({
          id: lineIds[index]!,
          tenantId: input.tenantId,
          shipmentId: input.shipmentId,
          lineNo: index + 1,
          productSkuId:
            input.resolvedProductSkuIds.get(line.productNumber) ?? null,
          productNumberSnapshot: line.productNumber,
          quantity: line.quantity,
          quantityUnit: line.quantityUnit,
          sourceHandoffId: handoffId,
          sourceLineId: `operator:${index + 1}`,
          version: 1,
          state: "active",
        })),
      });

      for (const containerRecordId of requestedContainerIds) {
        const previousVersion = await tx.containerCargoAllocationSet.aggregate({
          where: { tenantId: input.tenantId, containerRecordId },
          _max: { version: true },
        });
        const allocationSetId = randomUUID();
        await tx.containerCargoAllocationSet.create({
          data: {
            id: allocationSetId,
            tenantId: input.tenantId,
            containerRecordId,
            version: (previousVersion._max.version ?? 0) + 1,
            state: "active",
            ingestionChannel: "manual_ui",
            sourceSystem: "logix.operator_cargo_completion",
            evidenceRefs: [input.evidenceRef],
            idempotencyKey: `${input.command.idempotencyKey}:container:${containerRecordId}`,
            payloadHash,
          },
        });
        const allocations = input.command.lines.flatMap((line, index) =>
          line.containerRecordId.toLowerCase() === containerRecordId
            ? [
                {
                  id: randomUUID(),
                  tenantId: input.tenantId,
                  allocationSetId,
                  shipmentCargoLineId: lineIds[index]!,
                  allocatedQuantity: line.quantity,
                  quantityUnit: line.quantityUnit,
                },
              ]
            : [],
        );
        await tx.containerCargoAllocation.createMany({ data: allocations });
      }

      return {
        duplicate: false,
        relationshipVersion: shipment.relationshipVersion,
        cargoLineCount: input.command.lines.length,
        unmatchedSkuCount: input.command.lines.filter(
          ({ productNumber }) =>
            !input.resolvedProductSkuIds.has(productNumber),
        ).length,
        traceId: input.traceId,
      };
    });
  }
}

function hashCommand(
  command: CompleteShipmentPendingCargoInput["command"],
): string {
  const canonical = {
    contractVersion: command.contractVersion,
    expectedRelationshipVersion: command.expectedRelationshipVersion,
    occurredAt: command.occurredAt,
    idempotencyKey: command.idempotencyKey,
    lines: command.lines.map((line) => ({
      containerRecordId: line.containerRecordId,
      productNumber: line.productNumber,
      quantity: line.quantity,
      quantityUnit: line.quantityUnit,
    })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

async function acquireLock(tx: Transaction, lockKey: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ) AS acquired
  `;
}
