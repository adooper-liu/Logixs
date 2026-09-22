import { createHash } from "node:crypto";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type {
  CanonicalEventCode,
  LifecycleDateFactCommand,
  LifecycleDateFactInboxPayload,
  LifecycleNodeCode,
} from "@logix/contracts";
import {
  LIFECYCLE_DATE_FACT_INBOX_KIND,
  LIFECYCLE_INBOX_CONSUMER_NAME,
  hashLifecycleDateFactInboxPayload,
} from "@logix/contracts/lifecycle-date-fact-inbox";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ApplyReplenishmentOrderImportCommand,
  ApplyReplenishmentOrderImportResult,
  ReplenishmentOrderImportWriter,
  ShipmentTimeFactImport,
} from "../domain/apply-replenishment-order-import";

@Injectable()
export class PrismaReplenishmentOrderImportWriter implements ReplenishmentOrderImportWriter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  apply(
    command: ApplyReplenishmentOrderImportCommand,
  ): Promise<ApplyReplenishmentOrderImportResult> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.replenishmentOrder.upsert({
        where: {
          tenantId_orderNumber: {
            tenantId: command.tenantId,
            orderNumber: command.orderNumber,
          },
        },
        create: {
          tenantId: command.tenantId,
          orderNumber: command.orderNumber,
        },
        update: {},
      });
      await transaction.$queryRaw`
        SELECT "id"
        FROM "replenishment_order"
        WHERE "id" = ${order.id}
        FOR UPDATE
      `;

      if (command.containerNumber) {
        const importScope = `${command.tenantId}\u001f${command.containerNumber}`;
        await transaction.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${importScope}, 0))
        `;
      }

      const importBinding = command.containerNumber
        ? await transaction.containerImportBinding.findUnique({
            where: {
              tenantId_sourceBatchId_containerNumber: {
                tenantId: command.tenantId,
                sourceBatchId: command.sourceBatchId,
                containerNumber: command.containerNumber,
              },
            },
            include: { containerRecord: true },
          })
        : null;
      const containers = importBinding
        ? [importBinding.containerRecord]
        : await transaction.containerRecord.findMany({
            where: {
              tenantId: command.tenantId,
              orderNumber: command.orderNumber,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 2,
          });
      if (
        !importBinding &&
        containers.length === 0 &&
        command.containerNumber
      ) {
        const sameNumber = await transaction.containerRecord.findMany({
          where: {
            tenantId: command.tenantId,
            containerNumber: command.containerNumber,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
        });
        if (sameNumber.length > 0) {
          throw new ConflictException("CONTAINER_INSTANCE_RESOLUTION_REQUIRED");
        }
      }
      if (containers.length > 1) {
        throw new ConflictException("LEGACY_ORDER_CONTAINER_CONFLICT");
      }

      const existing = containers[0];
      if (
        existing?.containerNumber &&
        command.containerNumber &&
        existing.containerNumber !== command.containerNumber
      ) {
        throw new ConflictException("CONTAINER_NUMBER_CONFLICT");
      }

      const container = existing
        ? await transaction.containerRecord.update({
            where: { id: existing.id },
            data: {
              ...(existing.replenishmentOrderId
                ? {}
                : { replenishmentOrderId: order.id }),
              containerNumber:
                command.containerNumber ?? existing.containerNumber,
            },
          })
        : await transaction.containerRecord.create({
            data: {
              tenantId: command.tenantId,
              orderNumber: command.orderNumber,
              replenishmentOrderId: order.id,
              containerNumber: command.containerNumber,
              currentStatus: "not_shipped",
            },
          });
      if (command.containerNumber && !importBinding) {
        await transaction.containerImportBinding.create({
          data: {
            tenantId: command.tenantId,
            sourceBatchId: command.sourceBatchId,
            containerNumber: command.containerNumber,
            containerRecordId: container.id,
          },
        });
      }

      const sharedAcrossOrders =
        existing?.replenishmentOrderId != null &&
        existing.replenishmentOrderId !== order.id;
      const factCodes = command.timeFacts.map(({ factCode }) => factCode);
      if (sharedAcrossOrders && factCodes.length > 0) {
        const currentFacts = await transaction.shipmentTimeFact.findMany({
          where: {
            containerRecordId: container.id,
            factCode: { in: factCodes },
            isCurrent: true,
          },
        });
        const incomingByCode = new Map<string, ShipmentTimeFactImport>(
          command.timeFacts.map((fact) => [fact.factCode, fact]),
        );
        if (
          currentFacts.some((fact) => {
            const incoming = incomingByCode.get(fact.factCode);
            return incoming && !sameShipmentTimeFact(fact, incoming);
          })
        ) {
          throw new ConflictException("SHARED_CONTAINER_TIME_FACT_CONFLICT");
        }
      }
      const dateFactInboxMessages = buildDateFactInboxMessages(
        command,
        container.id,
      );

      const existingSourceLines =
        await transaction.replenishmentOrderLine.findMany({
          where: {
            replenishmentOrderId: order.id,
            sourceBatchId: command.sourceBatchId,
          },
          select: { sourceRowId: true },
        });
      if (existingSourceLines.length > 0) {
        const existingRows = new Set(
          existingSourceLines.map(({ sourceRowId }) => sourceRowId),
        );
        if (
          existingRows.size !== command.lines.length ||
          command.lines.some((line) => !existingRows.has(line.sourceRowId))
        ) {
          throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
        }
        const existingFacts = await transaction.shipmentTimeFact.findMany({
          where: {
            containerRecordId: container.id,
            sourceBatchId: command.sourceBatchId,
          },
          select: { sourceRowId: true, factCode: true },
        });
        const expectedFacts = new Set(
          command.timeFacts.map(
            (fact) => `${fact.sourceRowId}\u001f${fact.factCode}`,
          ),
        );
        if (
          existingFacts.length !== expectedFacts.size ||
          existingFacts.some(
            (fact) =>
              !expectedFacts.has(`${fact.sourceRowId}\u001f${fact.factCode}`),
          )
        ) {
          throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
        }
        await ensureDateFactInboxMessages(transaction, dateFactInboxMessages);
        return {
          replenishmentOrderId: order.id,
          containerRecordId: container.id,
          created: !existing,
        };
      }

      await transaction.replenishmentOrderLine.updateMany({
        where: { replenishmentOrderId: order.id, isCurrent: true },
        data: {
          isCurrent: false,
          supersededByBatchId: command.sourceBatchId,
        },
      });
      await transaction.replenishmentOrderLine.createMany({
        data: command.lines.map((line) => ({
          tenantId: command.tenantId,
          replenishmentOrderId: order.id,
          sourceBatchId: command.sourceBatchId,
          sourceRowId: line.sourceRowId,
          productNumber: line.productNumber,
          shippedQuantity: line.shippedQuantity,
          quantityUnit: line.quantityUnit,
          contractNumber: line.contractNumber,
        })),
      });

      if (factCodes.length > 0) {
        await transaction.shipmentTimeFact.updateMany({
          where: {
            containerRecordId: container.id,
            factCode: { in: factCodes },
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            supersededByBatchId: command.sourceBatchId,
          },
        });
        await transaction.shipmentTimeFact.createMany({
          data: command.timeFacts.map((fact) => ({
            tenantId: command.tenantId,
            containerRecordId: container.id,
            sourceBatchId: command.sourceBatchId,
            sourceRowId: fact.sourceRowId,
            factCode: fact.factCode,
            timeKind: fact.timeKind,
            captureSource: fact.captureSource,
            eventCode: fact.eventCode,
            rawValue: fact.rawValue,
            occurredAtUtc: fact.occurredAtUtc,
            sourceUtcOffset: fact.sourceUtcOffset,
            sourceSystem: fact.sourceSystem,
            authoritySystem: fact.authoritySystem,
            sourceStatus: fact.sourceStatus,
            evidenceRef: fact.evidenceRef,
            derivationRuleVersion: fact.derivationRuleVersion,
          })),
        });
      }
      await ensureDateFactInboxMessages(transaction, dateFactInboxMessages);

      return {
        replenishmentOrderId: order.id,
        containerRecordId: container.id,
        created: !existing,
      };
    });
  }
}

function sameShipmentTimeFact(
  existing: {
    timeKind: string;
    captureSource: string;
    eventCode: string | null;
    rawValue: string;
    occurredAtUtc: Date;
    sourceUtcOffset: string;
    sourceSystem: string;
    authoritySystem: string | null;
    sourceStatus: string | null;
    evidenceRef: string | null;
    derivationRuleVersion: string | null;
  },
  incoming: ShipmentTimeFactImport,
): boolean {
  return (
    existing.timeKind === incoming.timeKind &&
    existing.captureSource === incoming.captureSource &&
    existing.eventCode === incoming.eventCode &&
    existing.rawValue === incoming.rawValue &&
    existing.occurredAtUtc.getTime() === incoming.occurredAtUtc.getTime() &&
    existing.sourceUtcOffset === incoming.sourceUtcOffset &&
    existing.sourceSystem === incoming.sourceSystem &&
    existing.authoritySystem === incoming.authoritySystem &&
    existing.sourceStatus === incoming.sourceStatus &&
    existing.evidenceRef === incoming.evidenceRef &&
    existing.derivationRuleVersion === incoming.derivationRuleVersion
  );
}

interface DateFactInboxMessage {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payloadJson: LifecycleDateFactInboxPayload;
  causationId: string;
  state: "received";
  attemptCount: 0;
  traceId: string;
  receivedAt: Date;
}

function buildDateFactInboxMessages(
  command: ApplyReplenishmentOrderImportCommand,
  containerId: string,
): DateFactInboxMessage[] {
  return command.timeFacts.flatMap((fact) => {
    if (!fact.eventCode || !fact.nodeCode) return [];
    const idempotencyKey = [
      "import-date-fact",
      command.sourceBatchId,
      fact.sourceRowId,
      fact.factCode,
    ].join(":");
    const traceId = `import:${command.sourceBatchId}`;
    const dateFactCommand: LifecycleDateFactCommand = {
      tenantId: command.tenantId,
      containerId,
      nodeCode: fact.nodeCode as LifecycleNodeCode,
      eventCode: fact.eventCode as CanonicalEventCode,
      timeKind: fact.timeKind,
      occurredAt: fact.occurredAtUtc.toISOString(),
      rawValue: fact.rawValue,
      sourceUtcOffset: fact.sourceUtcOffset,
      ingestionChannel: "file_import",
      captureSource: fact.captureSource,
      sourceSystem: fact.sourceSystem,
      authoritySystem: fact.authoritySystem,
      interfaceCode: "controlled-import",
      sourceEventId: `${command.sourceBatchId}:${fact.sourceRowId}:${fact.factCode}`,
      mappingVersion: fact.mappingVersion,
      verificationState: "pending",
      confidenceState: "unknown",
      validity: "effective",
      evidenceRefs: fact.evidenceRef ? [fact.evidenceRef] : [],
      idempotencyKey,
      traceId,
    };
    const payload: LifecycleDateFactInboxPayload = {
      kind: LIFECYCLE_DATE_FACT_INBOX_KIND,
      command: dateFactCommand,
    };
    const messageId = deterministicUuid(idempotencyKey);
    return [
      {
        id: messageId,
        tenantId: command.tenantId,
        consumerName: LIFECYCLE_INBOX_CONSUMER_NAME,
        messageId,
        payloadHash: hashLifecycleDateFactInboxPayload(payload),
        payloadJson: payload,
        causationId: command.sourceBatchId,
        state: "received",
        attemptCount: 0,
        traceId,
        receivedAt: new Date(),
      },
    ];
  });
}

async function ensureDateFactInboxMessages(
  transaction: {
    inboxMessage: {
      findMany(
        input: unknown,
      ): Promise<Array<{ messageId: string; payloadHash: string }>>;
      createMany(input: unknown): Promise<unknown>;
    };
  },
  messages: DateFactInboxMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const existing = await transaction.inboxMessage.findMany({
    where: {
      consumerName: LIFECYCLE_INBOX_CONSUMER_NAME,
      messageId: { in: messages.map(({ messageId }) => messageId) },
    },
    select: { messageId: true, payloadHash: true },
  });
  const existingById = new Map(
    existing.map((message) => [message.messageId, message.payloadHash]),
  );
  for (const message of messages) {
    const existingHash = existingById.get(message.messageId);
    if (existingHash && existingHash !== message.payloadHash) {
      throw new ConflictException("IMPORT_BATCH_REPLAY_CONFLICT");
    }
  }
  const missing = messages.filter(
    (message) => !existingById.has(message.messageId),
  );
  if (missing.length > 0) {
    await transaction.inboxMessage.createMany({
      data: missing.map((message) => ({
        ...message,
        payloadJson: JSON.parse(JSON.stringify(message.payloadJson)),
      })),
    });
  }
}

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256")
    .update(value, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
