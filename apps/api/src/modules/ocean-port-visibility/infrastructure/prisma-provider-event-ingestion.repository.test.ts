import { describe, expect, it, vi } from "vitest";
import type { ProviderEventIngestionRecord } from "../domain/provider-event-ingestion.repository";
import { PrismaProviderEventIngestionRepository } from "./prisma-provider-event-ingestion.repository";

const NOW = new Date("2026-09-18T02:30:00.000Z");
const RECORD: ProviderEventIngestionRecord = {
  id: "ingestion-1",
  inboxRecordId: "inbox-1",
  tenantId: "tenant-1",
  consumerName: "ocean-port-visibility.trackingeyes.container-status.v1",
  messageId: "11111111-1111-4111-8111-111111111111",
  provider: "trackingeyes",
  interfaceCode: "trackingeyes.container.status",
  providerEventIdRaw: "event-1",
  idempotencyKey: "trackingeyes:event:event-1",
  rawPayload: { rawCode: "DLPT" },
  payloadHash: "a".repeat(64),
  payloadHashVersion: "trackingeyes-container-status-canonical-v1",
  containerNumberRaw: "TEST0000001",
  rawCode: "DLPT",
  eventTimeRaw: "2026-09-18T10:30:00+08:00",
  mappingVersion: "trackingeyes-ocean-reference-2026-09-18",
  normalizationKind: "candidate",
  canonicalEventCode: "departed",
  occurredAt: NOW,
  timeKind: "actual",
  sourceCodeRaw: "1",
  sourceSignal: "carrier",
  authorityDecision: "review_required",
  authorityPolicyRef: null,
  confidenceState: "unknown",
  reasonCodes: ["source_authority_policy_required"],
  lifecycleApplication: "not_applied",
  decidedBy: "service:trackingeyes-adapter",
  traceId: "trace-1",
  receivedAt: NOW,
  decidedAt: NOW,
};

describe("PrismaProviderEventIngestionRepository", () => {
  it("在同一事务写入 processed Inbox 与原始接入记录", async () => {
    const inboxCreate = vi.fn().mockResolvedValue({});
    const ingestionCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: unknown) => Promise<void>): Promise<void> => {
          await callback({
            inboxMessage: { create: inboxCreate },
            oceanProviderEventIngestion: { create: ingestionCreate },
          });
        },
      ),
    };
    const repository = new PrismaProviderEventIngestionRepository(
      prisma as never,
    );

    await repository.insertProcessed(RECORD);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(inboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "inbox-1",
        state: "processed",
        processedAt: NOW,
        payloadJson: {
          contentRef: "ocean-provider-event/ingestion-1",
          ingestionId: "ingestion-1",
          provider: "trackingeyes",
          interfaceCode: "trackingeyes.container.status",
        },
      }),
    });
    expect(ingestionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "ingestion-1",
        inboxMessageId: "inbox-1",
        rawPayload: { rawCode: "DLPT" },
        authorityDecision: "review_required",
        lifecycleApplication: "not_applied",
      }),
    });
  });

  it("按 Inbox 消息键读取并显式映射接入记录", async () => {
    const prisma = {
      inboxMessage: {
        findUnique: vi.fn().mockResolvedValue({
          id: RECORD.inboxRecordId,
          tenantId: RECORD.tenantId,
          consumerName: RECORD.consumerName,
          messageId: RECORD.messageId,
          payloadHash: RECORD.payloadHash,
          traceId: RECORD.traceId,
          receivedAt: RECORD.receivedAt,
        }),
      },
      oceanProviderEventIngestion: {
        findUnique: vi.fn().mockResolvedValue({
          id: RECORD.id,
          tenantId: RECORD.tenantId,
          provider: RECORD.provider,
          interfaceCode: RECORD.interfaceCode,
          providerEventIdRaw: RECORD.providerEventIdRaw,
          idempotencyKey: RECORD.idempotencyKey,
          rawPayload: RECORD.rawPayload,
          payloadHash: RECORD.payloadHash,
          payloadHashVersion: RECORD.payloadHashVersion,
          containerNumberRaw: RECORD.containerNumberRaw,
          rawCode: RECORD.rawCode,
          eventTimeRaw: RECORD.eventTimeRaw,
          mappingVersion: RECORD.mappingVersion,
          normalizationKind: RECORD.normalizationKind,
          canonicalEventCode: RECORD.canonicalEventCode,
          occurredAt: RECORD.occurredAt,
          timeKind: RECORD.timeKind,
          sourceCodeRaw: RECORD.sourceCodeRaw,
          sourceSignal: RECORD.sourceSignal,
          authorityDecision: RECORD.authorityDecision,
          authorityPolicyRef: RECORD.authorityPolicyRef,
          confidenceState: RECORD.confidenceState,
          reasonCodes: RECORD.reasonCodes,
          lifecycleApplication: RECORD.lifecycleApplication,
          decidedBy: RECORD.decidedBy,
          traceId: RECORD.traceId,
          receivedAt: RECORD.receivedAt,
          decidedAt: RECORD.decidedAt,
        }),
      },
    };
    const repository = new PrismaProviderEventIngestionRepository(
      prisma as never,
    );

    const found = await repository.findByInboxMessage({
      consumerName: RECORD.consumerName,
      messageId: RECORD.messageId,
    });

    expect(prisma.inboxMessage.findUnique).toHaveBeenCalledWith({
      where: {
        consumerName_messageId: {
          consumerName: RECORD.consumerName,
          messageId: RECORD.messageId,
        },
      },
    });
    expect(found).toEqual(RECORD);
  });
});
