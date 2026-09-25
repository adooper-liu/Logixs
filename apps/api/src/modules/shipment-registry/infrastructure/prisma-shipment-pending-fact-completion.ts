import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ShipmentPendingFactCompletionConflictError,
  ShipmentPendingFactCompletionNotFoundError,
  type CompleteShipmentPendingFactsInput,
  type CompleteShipmentPendingFactsOutput,
  type ShipmentPendingFactCompletionPort,
} from "../shipment-pending-fact-completion.port";

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PrismaShipmentPendingFactCompletion implements ShipmentPendingFactCompletionPort {
  constructor(private readonly prisma: PrismaService) {}

  async complete(
    input: CompleteShipmentPendingFactsInput,
  ): Promise<CompleteShipmentPendingFactsOutput> {
    const payloadHash = hashCommand(input.command);
    return this.prisma.$transaction(async (tx) => {
      await acquireLock(
        tx,
        `shipment-pending-facts:${input.tenantId}:${input.command.idempotencyKey}`,
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
        },
      });
      if (replay) {
        if (
          replay.shipmentId !== input.shipmentId ||
          replay.sourceSystem !== "logix.operator_completion" ||
          replay.payloadHash !== payloadHash
        ) {
          throw new ShipmentPendingFactCompletionConflictError(
            "IDEMPOTENCY_PAYLOAD_CONFLICT",
          );
        }
        return {
          duplicate: true,
          relationshipVersion: input.command.expectedRelationshipVersion,
          traceId: replay.traceId,
        };
      }

      await acquireLock(
        tx,
        `shipment-pending-facts:${input.tenantId}:${input.shipmentId}`,
      );

      const current = await tx.shipment.findFirst({
        where: { id: input.shipmentId, tenantId: input.tenantId },
        select: {
          relationshipVersion: true,
          carrierCode: true,
          vesselName: true,
          voyageNumber: true,
          originUnlocode: true,
          destinationUnlocode: true,
          atdAt: true,
        },
      });
      if (!current) {
        throw new ShipmentPendingFactCompletionNotFoundError(
          "SHIPMENT_NOT_FOUND",
        );
      }
      if (
        current.relationshipVersion !==
        input.command.expectedRelationshipVersion
      ) {
        throw new ShipmentPendingFactCompletionConflictError(
          "TARGET_SHIPMENT_VERSION_CONFLICT",
        );
      }

      const facts = input.command.facts;
      assertCompatible(current.carrierCode, facts.carrierCode);
      assertCompatible(current.vesselName, facts.vesselName);
      assertCompatible(current.voyageNumber, facts.voyageNumber);
      assertCompatible(current.originUnlocode, facts.originPortCode);
      assertCompatible(current.destinationUnlocode, facts.destinationPortCode);
      const atdAt =
        facts.departureProof?.kind === "actual_departure_time"
          ? new Date(facts.departureProof.occurredAt)
          : undefined;
      if (
        current.atdAt &&
        atdAt &&
        current.atdAt.getTime() !== atdAt.getTime()
      ) {
        throw new ShipmentPendingFactCompletionConflictError(
          "SHIPMENT_FACT_CORRECTION_REQUIRED",
        );
      }

      const updated = await tx.shipment.updateMany({
        where: {
          id: input.shipmentId,
          tenantId: input.tenantId,
          relationshipVersion: input.command.expectedRelationshipVersion,
        },
        data: {
          carrierCode: facts.carrierCode ?? undefined,
          vesselName: facts.vesselName ?? undefined,
          voyageNumber: facts.voyageNumber ?? undefined,
          originCountryCode: facts.originPortCode?.slice(0, 2),
          originUnlocode: facts.originPortCode ?? undefined,
          destinationCountryCode: facts.destinationPortCode?.slice(0, 2),
          destinationUnlocode: facts.destinationPortCode ?? undefined,
          atdAt,
          updatedBy: input.actorId,
        },
      });
      if (updated.count !== 1) {
        throw new ShipmentPendingFactCompletionConflictError(
          "TARGET_SHIPMENT_VERSION_CONFLICT",
        );
      }

      const digest = createHash("sha256")
        .update(
          `${input.tenantId}:${input.shipmentId}:${input.command.idempotencyKey}`,
        )
        .digest("hex");
      await tx.shipmentHandoffRecord.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          sourceProfile: "api_v1",
          ingestionChannel: "manual",
          sourceSystem: "logix.operator_completion",
          externalHandoffId: `shipment-completion:${input.shipmentId}:${digest.slice(0, 32)}`,
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
      return {
        duplicate: false,
        relationshipVersion: input.command.expectedRelationshipVersion,
        traceId: input.traceId,
      };
    });
  }
}

function hashCommand(
  command: CompleteShipmentPendingFactsInput["command"],
): string {
  const departureProof =
    command.facts.departureProof?.kind === "actual_departure_time"
      ? command.facts.departureProof
      : undefined;
  const canonical = {
    contractVersion: command.contractVersion,
    expectedRelationshipVersion: command.expectedRelationshipVersion,
    occurredAt: command.occurredAt,
    idempotencyKey: command.idempotencyKey,
    facts: {
      ...(command.facts.carrierCode !== undefined
        ? { carrierCode: command.facts.carrierCode }
        : {}),
      ...(command.facts.vesselName !== undefined
        ? { vesselName: command.facts.vesselName }
        : {}),
      ...(command.facts.voyageNumber !== undefined
        ? { voyageNumber: command.facts.voyageNumber }
        : {}),
      ...(command.facts.originPortCode !== undefined
        ? { originPortCode: command.facts.originPortCode }
        : {}),
      ...(command.facts.destinationPortCode !== undefined
        ? { destinationPortCode: command.facts.destinationPortCode }
        : {}),
      ...(departureProof
        ? {
            departureProof: {
              kind: departureProof.kind,
              occurredAt: departureProof.occurredAt,
              sourceTimezone: departureProof.sourceTimezone,
              evidenceRef: departureProof.evidenceRef,
            },
          }
        : {}),
    },
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function assertCompatible(
  current: string | null,
  incoming: string | null | undefined,
): void {
  if (current && incoming && current !== incoming) {
    throw new ShipmentPendingFactCompletionConflictError(
      "SHIPMENT_FACT_CORRECTION_REQUIRED",
    );
  }
}

async function acquireLock(tx: Transaction, lockKey: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ) AS acquired
  `;
}
