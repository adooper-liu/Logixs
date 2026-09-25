import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  ShipmentPendingDocumentCompletionConflictError,
  ShipmentPendingDocumentCompletionNotFoundError,
  type CompleteShipmentPendingDocumentsInput,
  type CompleteShipmentPendingDocumentsOutput,
  type ShipmentPendingDocumentCompletionPort,
} from "../shipment-pending-document-completion.port";

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PrismaShipmentPendingDocumentCompletion implements ShipmentPendingDocumentCompletionPort {
  constructor(private readonly prisma: PrismaService) {}

  async complete(
    input: CompleteShipmentPendingDocumentsInput,
  ): Promise<CompleteShipmentPendingDocumentsOutput> {
    const payloadHash = hashCommand(input.command);
    return this.prisma.$transaction(async (tx) => {
      await acquireLock(
        tx,
        `shipment-pending-document:${input.tenantId}:${input.command.idempotencyKey}`,
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
          transportDocuments: { select: { id: true } },
        },
      });
      if (replay) {
        if (
          replay.shipmentId !== input.shipmentId ||
          replay.sourceSystem !== "logix.operator_document_completion" ||
          replay.payloadHash !== payloadHash
        ) {
          throw new ShipmentPendingDocumentCompletionConflictError(
            "IDEMPOTENCY_PAYLOAD_CONFLICT",
          );
        }
        return {
          duplicate: true,
          relationshipVersion: input.command.expectedRelationshipVersion,
          documentCount: replay.transportDocuments.length,
          traceId: replay.traceId,
        };
      }

      await acquireLock(
        tx,
        `shipment-pending-document:${input.tenantId}:${input.shipmentId}`,
      );
      const shipment = await tx.shipment.findFirst({
        where: { id: input.shipmentId, tenantId: input.tenantId },
        select: {
          relationshipVersion: true,
          containerLinks: {
            where: { state: "active", supersededAt: null },
            select: { id: true, containerRecordId: true },
          },
        },
      });
      if (!shipment) {
        throw new ShipmentPendingDocumentCompletionNotFoundError(
          "SHIPMENT_NOT_FOUND",
        );
      }
      if (
        shipment.relationshipVersion !==
        input.command.expectedRelationshipVersion
      ) {
        throw new ShipmentPendingDocumentCompletionConflictError(
          "TARGET_SHIPMENT_VERSION_CONFLICT",
        );
      }
      const linksByContainerId = new Map(
        shipment.containerLinks.map((link) => [
          link.containerRecordId.toLowerCase(),
          link,
        ]),
      );
      if (
        input.command.documents.some((document) =>
          document.containerRecordIds.some(
            (containerRecordId) =>
              !linksByContainerId.has(containerRecordId.toLowerCase()),
          ),
        )
      ) {
        throw new ShipmentPendingDocumentCompletionConflictError(
          "SHIPMENT_CONTAINER_REFERENCE_INVALID",
        );
      }
      const identities = input.command.documents.map((document) =>
        documentIdentity(document.documentType, document.documentNumber),
      );
      if (new Set(identities).size !== identities.length) {
        throw new ShipmentPendingDocumentCompletionConflictError(
          "SHIPMENT_DOCUMENT_DUPLICATE_IN_COMMAND",
        );
      }
      const existing = await tx.shipmentTransportDocument.findMany({
        where: {
          tenantId: input.tenantId,
          shipmentId: input.shipmentId,
          OR: input.command.documents.map(
            ({ documentType, documentNumber }) => ({
              documentType,
              documentNumber,
            }),
          ),
        },
        select: {
          documentType: true,
          documentNumber: true,
          version: true,
          state: true,
        },
      });
      if (existing.some(({ state }) => state === "active")) {
        throw new ShipmentPendingDocumentCompletionConflictError(
          "SHIPMENT_DOCUMENT_ALREADY_EXISTS",
        );
      }
      const nextVersion = new Map<string, number>();
      for (const document of input.command.documents) {
        const identity = documentIdentity(
          document.documentType,
          document.documentNumber,
        );
        nextVersion.set(
          identity,
          Math.max(
            0,
            ...existing
              .filter(
                (row) =>
                  documentIdentity(row.documentType, row.documentNumber) ===
                  identity,
              )
              .map(({ version }) => version),
          ) + 1,
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
          sourceSystem: "logix.operator_document_completion",
          externalHandoffId: `shipment-document-completion:${input.shipmentId}:${digest.slice(0, 32)}`,
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

      for (const document of input.command.documents) {
        const documentId = randomUUID();
        const identity = documentIdentity(
          document.documentType,
          document.documentNumber,
        );
        await tx.shipmentTransportDocument.create({
          data: {
            id: documentId,
            tenantId: input.tenantId,
            shipmentId: input.shipmentId,
            documentType: document.documentType,
            documentNumber: document.documentNumber,
            scac: document.scac,
            version: nextVersion.get(identity)!,
            state: "active",
            sourceHandoffId: handoffId,
            effectiveFrom: new Date(input.command.occurredAt),
          },
        });
        await tx.shipmentContainerDocumentLink.createMany({
          data: document.containerRecordIds.map((containerRecordId) => {
            const link = linksByContainerId.get(
              containerRecordId.toLowerCase(),
            )!;
            return {
              id: randomUUID(),
              tenantId: input.tenantId,
              shipmentId: input.shipmentId,
              containerRecordId: link.containerRecordId,
              shipmentContainerLinkId: link.id,
              transportDocumentId: documentId,
              sourceHandoffId: handoffId,
            };
          }),
        });
        await tx.shipmentHandoffObjectResult.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            handoffId,
            objectType: "transport_document",
            sourceRef: `${document.documentType}:${document.documentNumber}`,
            resultState: "accepted",
            entityId: documentId,
            issueCodes: [],
          },
        });
      }
      await tx.shipment.update({
        where: { id: input.shipmentId },
        data: { updatedBy: input.actorId },
      });
      return {
        duplicate: false,
        relationshipVersion: shipment.relationshipVersion,
        documentCount: input.command.documents.length,
        traceId: input.traceId,
      };
    });
  }
}

function documentIdentity(
  documentType: string,
  documentNumber: string,
): string {
  return `${documentType}\u0000${documentNumber}`;
}

function hashCommand(
  command: CompleteShipmentPendingDocumentsInput["command"],
): string {
  return createHash("sha256").update(JSON.stringify(command)).digest("hex");
}

async function acquireLock(tx: Transaction, lockKey: string): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "lockAcquired"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    ) AS acquired
  `;
}
