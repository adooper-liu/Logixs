import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ProviderEventIngestionRecord,
  ProviderEventIngestionRepository,
} from "../domain/provider-event-ingestion.repository";

@Injectable()
export class PrismaProviderEventIngestionRepository implements ProviderEventIngestionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByInboxMessage(input: {
    consumerName: string;
    messageId: string;
  }): Promise<ProviderEventIngestionRecord | null> {
    const inbox = await this.prisma.inboxMessage.findUnique({
      where: {
        consumerName_messageId: {
          consumerName: input.consumerName,
          messageId: input.messageId,
        },
      },
    });
    if (!inbox) return null;

    const ingestion = await this.prisma.oceanProviderEventIngestion.findUnique({
      where: { inboxMessageId: inbox.id },
    });
    if (!ingestion) {
      throw new Error("INBOX_INGESTION_INVARIANT_VIOLATION");
    }
    return toRecord(inbox, ingestion);
  }

  async insertProcessed(record: ProviderEventIngestionRecord): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.inboxMessage.create({
        data: {
          id: record.inboxRecordId,
          tenantId: record.tenantId,
          consumerName: record.consumerName,
          messageId: record.messageId,
          payloadHash: record.payloadHash,
          payloadJson: {
            contentRef: `ocean-provider-event/${record.id}`,
            ingestionId: record.id,
            provider: record.provider,
            interfaceCode: record.interfaceCode,
          },
          state: "processed",
          attemptCount: 1,
          processedAt: record.decidedAt,
          traceId: record.traceId,
          receivedAt: record.receivedAt,
        },
      });
      await tx.oceanProviderEventIngestion.create({
        data: {
          id: record.id,
          inboxMessageId: record.inboxRecordId,
          tenantId: record.tenantId,
          provider: record.provider,
          interfaceCode: record.interfaceCode,
          providerEventIdRaw: record.providerEventIdRaw,
          idempotencyKey: record.idempotencyKey,
          rawPayload: JSON.parse(JSON.stringify(record.rawPayload)),
          payloadHash: record.payloadHash,
          payloadHashVersion: record.payloadHashVersion,
          containerNumberRaw: record.containerNumberRaw,
          rawCode: record.rawCode,
          eventTimeRaw: record.eventTimeRaw,
          mappingVersion: record.mappingVersion,
          normalizationKind: record.normalizationKind,
          canonicalEventCode: record.canonicalEventCode,
          occurredAt: record.occurredAt,
          timeKind: record.timeKind,
          sourceCodeRaw: record.sourceCodeRaw,
          sourceSignal: record.sourceSignal,
          authorityDecision: record.authorityDecision,
          authorityPolicyRef: record.authorityPolicyRef,
          confidenceState: record.confidenceState,
          reasonCodes: record.reasonCodes,
          lifecycleApplication: record.lifecycleApplication,
          decidedBy: record.decidedBy,
          traceId: record.traceId,
          receivedAt: record.receivedAt,
          decidedAt: record.decidedAt,
        },
      });
    });
  }
}

function toRecord(
  inbox: {
    id: string;
    tenantId: string;
    consumerName: string;
    messageId: string;
    payloadHash: string;
    traceId: string;
    receivedAt: Date;
  },
  ingestion: {
    id: string;
    tenantId: string;
    provider: string;
    interfaceCode: string;
    providerEventIdRaw: string | null;
    idempotencyKey: string | null;
    rawPayload: unknown;
    payloadHash: string;
    payloadHashVersion: string;
    containerNumberRaw: string;
    rawCode: string;
    eventTimeRaw: string;
    mappingVersion: string;
    normalizationKind: string;
    canonicalEventCode: string | null;
    occurredAt: Date | null;
    timeKind: string | null;
    sourceCodeRaw: string;
    sourceSignal: string | null;
    authorityDecision: string;
    authorityPolicyRef: string | null;
    confidenceState: string;
    reasonCodes: unknown;
    lifecycleApplication: string;
    decidedBy: string;
    traceId: string;
    receivedAt: Date;
    decidedAt: Date;
  },
): ProviderEventIngestionRecord {
  if (inbox.payloadHash !== ingestion.payloadHash) {
    throw new Error("INBOX_INGESTION_HASH_INVARIANT_VIOLATION");
  }
  if (
    inbox.tenantId !== ingestion.tenantId ||
    inbox.traceId !== ingestion.traceId ||
    inbox.receivedAt.getTime() !== ingestion.receivedAt.getTime()
  ) {
    throw new Error("INBOX_INGESTION_SCOPE_INVARIANT_VIOLATION");
  }
  if (
    ingestion.normalizationKind !== "candidate" &&
    ingestion.normalizationKind !== "review_required" &&
    ingestion.normalizationKind !== "rejected"
  ) {
    throw new Error("INGESTION_NORMALIZATION_INVARIANT_VIOLATION");
  }
  if (
    ingestion.authorityDecision !== "review_required" &&
    ingestion.authorityDecision !== "rejected"
  ) {
    throw new Error("INGESTION_AUTHORITY_INVARIANT_VIOLATION");
  }
  if (
    ingestion.confidenceState !== "provisional" &&
    ingestion.confidenceState !== "unknown"
  ) {
    throw new Error("INGESTION_CONFIDENCE_INVARIANT_VIOLATION");
  }
  if (
    ingestion.timeKind !== null &&
    ingestion.timeKind !== "estimated" &&
    ingestion.timeKind !== "actual"
  ) {
    throw new Error("INGESTION_TIME_KIND_INVARIANT_VIOLATION");
  }
  if (ingestion.lifecycleApplication !== "not_applied") {
    throw new Error("INGESTION_LIFECYCLE_INVARIANT_VIOLATION");
  }
  if (
    !ingestion.rawPayload ||
    typeof ingestion.rawPayload !== "object" ||
    Array.isArray(ingestion.rawPayload)
  ) {
    throw new Error("INGESTION_RAW_PAYLOAD_INVARIANT_VIOLATION");
  }
  if (
    !Array.isArray(ingestion.reasonCodes) ||
    ingestion.reasonCodes.some((item) => typeof item !== "string")
  ) {
    throw new Error("INGESTION_REASON_CODES_INVARIANT_VIOLATION");
  }

  return {
    id: ingestion.id,
    inboxRecordId: inbox.id,
    tenantId: inbox.tenantId,
    consumerName: inbox.consumerName,
    messageId: inbox.messageId,
    provider: ingestion.provider,
    interfaceCode: ingestion.interfaceCode,
    providerEventIdRaw: ingestion.providerEventIdRaw,
    idempotencyKey: ingestion.idempotencyKey,
    rawPayload: ingestion.rawPayload as Record<string, unknown>,
    payloadHash: ingestion.payloadHash,
    payloadHashVersion: ingestion.payloadHashVersion,
    containerNumberRaw: ingestion.containerNumberRaw,
    rawCode: ingestion.rawCode,
    eventTimeRaw: ingestion.eventTimeRaw,
    mappingVersion: ingestion.mappingVersion,
    normalizationKind: ingestion.normalizationKind,
    canonicalEventCode: ingestion.canonicalEventCode,
    occurredAt: ingestion.occurredAt,
    timeKind: ingestion.timeKind,
    sourceCodeRaw: ingestion.sourceCodeRaw,
    sourceSignal: ingestion.sourceSignal,
    authorityDecision: ingestion.authorityDecision,
    authorityPolicyRef: ingestion.authorityPolicyRef,
    confidenceState: ingestion.confidenceState,
    reasonCodes: ingestion.reasonCodes as string[],
    lifecycleApplication: "not_applied",
    decidedBy: ingestion.decidedBy,
    traceId: inbox.traceId,
    receivedAt: inbox.receivedAt,
    decidedAt: ingestion.decidedAt,
  };
}
