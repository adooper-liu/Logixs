import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ShipmentPendingSkuBindingConflictError,
  ShipmentPendingSkuBindingNotFoundError,
  type BindShipmentPendingSkuInput,
  type BindShipmentPendingSkuOutput,
  type ShipmentPendingSkuBindingPort,
} from "../shipment-pending-sku-binding.port";

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PrismaShipmentPendingSkuBinding implements ShipmentPendingSkuBindingPort {
  constructor(private readonly prisma: PrismaService) {}

  async bind(
    input: BindShipmentPendingSkuInput,
  ): Promise<BindShipmentPendingSkuOutput> {
    const payloadHash = hashCommand(input);
    return this.prisma.$transaction(async (tx) => {
      await acquireLock(
        tx,
        `shipment-pending-sku:${input.tenantId}:${input.command.idempotencyKey}`,
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
          payloadJson: true,
          traceId: true,
        },
      });
      if (replay) {
        if (
          replay.shipmentId !== input.shipmentId ||
          replay.sourceSystem !== "logix.operator_sku_binding" ||
          replay.payloadHash !== payloadHash
        ) {
          throw new ShipmentPendingSkuBindingConflictError(
            "IDEMPOTENCY_PAYLOAD_CONFLICT",
          );
        }
        return {
          duplicate: true,
          relationshipVersion: input.command.expectedRelationshipVersion,
          cargoLineVersion: input.command.expectedCargoLineVersion + 1,
          skuResolution: replaySkuResolution(replay.payloadJson),
          traceId: replay.traceId,
        };
      }

      await acquireLock(
        tx,
        `shipment-pending-sku:${input.tenantId}:${input.shipmentId}`,
      );
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, tenantId: input.tenantId },
        select: { relationshipVersion: true },
      });
      if (!shipment) {
        throw new ShipmentPendingSkuBindingNotFoundError("SHIPMENT_NOT_FOUND");
      }
      if (
        shipment.relationshipVersion !==
        input.command.expectedRelationshipVersion
      ) {
        throw new ShipmentPendingSkuBindingConflictError(
          "TARGET_SHIPMENT_VERSION_CONFLICT",
        );
      }
      const cargoLine = await tx.shipmentCargoLine.findFirst({
        where: {
          id: input.command.cargoLineId,
          tenantId: input.tenantId,
          shipmentId: input.shipmentId,
          state: "active",
          supersededAt: null,
        },
        select: {
          id: true,
          version: true,
          productSkuId: true,
          productNumberSnapshot: true,
        },
      });
      if (!cargoLine) {
        throw new ShipmentPendingSkuBindingNotFoundError(
          "SHIPMENT_CARGO_LINE_NOT_FOUND",
        );
      }
      if (
        cargoLine.version !== input.command.expectedCargoLineVersion ||
        cargoLine.productSkuId
      ) {
        throw new ShipmentPendingSkuBindingConflictError(
          "SHIPMENT_CARGO_LINE_VERSION_CONFLICT",
        );
      }
      if (cargoLine.productNumberSnapshot !== input.productNumber) {
        throw new ShipmentPendingSkuBindingConflictError(
          "SHIPMENT_CARGO_SKU_NUMBER_MISMATCH",
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
          sourceSystem: "logix.operator_sku_binding",
          externalHandoffId: `shipment-sku-binding:${input.shipmentId}:${digest.slice(0, 32)}`,
          handoffVersion: 1,
          occurredAt: new Date(input.command.occurredAt),
          idempotencyKey: input.command.idempotencyKey,
          payloadHash,
          payloadJson: {
            ...input.command,
            productSkuId: input.productSkuId,
            productNumber: input.productNumber,
            skuResolution: input.skuResolution,
          } as Prisma.InputJsonValue,
          status: "accepted",
          shipmentId: input.shipmentId,
          actorId: input.actorId,
          traceId: input.traceId,
        },
      });
      const updated = await tx.shipmentCargoLine.updateMany({
        where: {
          id: cargoLine.id,
          tenantId: input.tenantId,
          shipmentId: input.shipmentId,
          version: input.command.expectedCargoLineVersion,
          productSkuId: null,
          state: "active",
          supersededAt: null,
        },
        data: {
          productSkuId: input.productSkuId,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ShipmentPendingSkuBindingConflictError(
          "SHIPMENT_CARGO_LINE_VERSION_CONFLICT",
        );
      }
      await tx.shipmentHandoffObjectResult.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          handoffId,
          objectType: "cargo_line",
          sourceRef: cargoLine.id,
          resultState: "accepted",
          entityId: cargoLine.id,
          issueCodes: [],
        },
      });
      await tx.shipment.update({
        where: { id: input.shipmentId },
        data: { updatedBy: input.actorId },
      });
      return {
        duplicate: false,
        relationshipVersion: shipment.relationshipVersion,
        cargoLineVersion: cargoLine.version + 1,
        skuResolution: input.skuResolution,
        traceId: input.traceId,
      };
    });
  }
}

function replaySkuResolution(
  payload: Prisma.JsonValue,
): "matched_existing" | "registered" {
  if (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    payload.skuResolution === "registered"
  ) {
    return "registered";
  }
  return "matched_existing";
}

function hashCommand(input: BindShipmentPendingSkuInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...input.command,
        productSkuId: input.productSkuId,
        productNumber: input.productNumber,
      }),
    )
    .digest("hex");
}

async function acquireLock(tx: Transaction, lockKey: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ) AS acquired
  `;
}
