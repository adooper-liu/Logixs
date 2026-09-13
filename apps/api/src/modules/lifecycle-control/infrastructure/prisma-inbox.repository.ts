import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { InboxReceivedRecord } from "../domain/inbox-message";
import { inboxPayloadRef } from "../domain/inbox-message";
import type { OutboxDeliveryDecision } from "../domain/outbox-failure";
import {
  beginInboxProcessing,
  completeInboxProcessed,
} from "../domain/inbox-processing";
import type { ClaimedInbox } from "../domain/inbox-processing";
import type {
  InboxDeadLetterSummary,
  InboxReplayRequestDraft,
  StoredInboxDeadLetter,
} from "../domain/inbox-replay";
import type {
  InboxRepository,
  StoredInboxMessage,
} from "../domain/inbox.repository";

type ClaimRow = {
  id: string;
  tenant_id: string;
  consumer_name: string;
  message_id: string;
  payload_hash: string;
  payload_json: unknown;
  state: string;
  attempt_count: number | bigint;
  locked_by: string | null;
  locked_at: Date | null;
  lease_expires_at: Date | null;
  trace_id: string;
  received_at: Date;
};

@Injectable()
export class PrismaInboxRepository implements InboxRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByConsumerMessage(input: {
    consumerName: string;
    messageId: string;
  }): Promise<StoredInboxMessage | null> {
    const row = await this.prisma.inboxMessage.findUnique({
      where: {
        consumerName_messageId: {
          consumerName: input.consumerName,
          messageId: input.messageId,
        },
      },
    });
    return row ? toStored(row) : null;
  }

  async insertReceived(record: InboxReceivedRecord): Promise<void> {
    await this.prisma.inboxMessage.create({
      data: {
        id: record.id,
        tenantId: record.tenantId,
        consumerName: record.consumerName,
        messageId: record.messageId,
        payloadHash: record.payloadHash,
        payloadJson:
          record.payloadJson === undefined || record.payloadJson === null
            ? undefined
            : JSON.parse(JSON.stringify(record.payloadJson)),
        causationId: record.causationId,
        state: record.state,
        attemptCount: record.attemptCount,
        traceId: record.traceId,
        receivedAt: record.receivedAt,
      },
    });
  }

  async claimBatch(input: {
    tenantId: string;
    consumerName: string;
    owner: string;
    now: Date;
    limit: number;
    leaseSeconds: number;
  }): Promise<ClaimedInbox[]> {
    const processing = beginInboxProcessing({
      attemptCount: 0,
      owner: input.owner,
      now: input.now,
      leaseSeconds: input.leaseSeconds,
    });
    const rows = await this.prisma.$queryRaw<ClaimRow[]>`
      UPDATE "inbox_message" AS i
      SET
        "state" = 'processing',
        "locked_by" = ${processing.lease.owner},
        "locked_at" = ${processing.lease.lockedAt},
        "lease_expires_at" = ${processing.lease.expiresAt},
        "attempt_count" = i."attempt_count" + 1,
        "updated_at" = ${input.now}
      WHERE i."id" IN (
        SELECT c."id"
        FROM "inbox_message" AS c
        WHERE c."tenant_id" = ${input.tenantId}
          AND c."consumer_name" = ${input.consumerName}
          AND (
            c."state" = 'received'
            OR (
              c."state" = 'retry_wait'
              AND (
                c."next_attempt_at" IS NULL
                OR c."next_attempt_at" <= ${input.now}
              )
            )
            OR (
              c."state" = 'processing'
              AND (
                c."lease_expires_at" IS NULL
                OR c."lease_expires_at" <= ${input.now}
              )
            )
          )
        ORDER BY c."received_at" ASC, c."id" ASC
        LIMIT ${input.limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        i."id",
        i."tenant_id",
        i."consumer_name",
        i."message_id",
        i."payload_hash",
        i."payload_json",
        i."state",
        i."attempt_count",
        i."locked_by",
        i."locked_at",
        i."lease_expires_at",
        i."trace_id",
        i."received_at"
    `;
    return rows.flatMap((row) => {
      const claimed = toClaimed(row);
      return claimed ? [claimed] : [];
    });
  }

  async markProcessed(input: {
    id: string;
    owner: string;
    processedAt: Date;
  }): Promise<{ messageId: string; processedAt: Date } | null> {
    const processed = completeInboxProcessed({
      processedAt: input.processedAt,
    });
    const updated = await this.prisma.inboxMessage.updateMany({
      where: {
        id: input.id,
        state: "processing",
        leaseOwner: input.owner,
      },
      data: {
        state: processed.state,
        processedAt: processed.processedAt,
        leaseOwner: null,
        leaseLockedAt: null,
        leaseExpiresAt: null,
      },
    });
    const current = await this.prisma.inboxMessage.findUnique({
      where: { id: input.id },
    });
    if (!current) return null;
    if (updated.count === 1 || current.state === "processed") {
      if (!current.processedAt) return null;
      return {
        messageId: current.messageId,
        processedAt: current.processedAt,
      };
    }
    return null;
  }

  async markConsumptionFailed(input: {
    id: string;
    owner: string;
    decision: OutboxDeliveryDecision;
  }): Promise<{
    messageId: string;
    state: OutboxDeliveryDecision["state"];
  } | null> {
    const data =
      input.decision.state === "retry_wait"
        ? {
            state: "retry_wait" as const,
            nextAttemptAt: input.decision.nextAttemptAt,
            lastErrorCode: input.decision.lastErrorCode,
            failureCategory: input.decision.failureCategory,
            leaseOwner: null,
            leaseLockedAt: null,
            leaseExpiresAt: null,
          }
        : {
            state: "dead_letter" as const,
            nextAttemptAt: null,
            lastErrorCode: input.decision.lastErrorCode,
            failureCategory: input.decision.failureCategory,
            deadLetteredAt: input.decision.deadLetteredAt,
            ownerQueue: input.decision.ownerQueue,
            leaseOwner: null,
            leaseLockedAt: null,
            leaseExpiresAt: null,
          };
    const updated = await this.prisma.inboxMessage.updateMany({
      where: {
        id: input.id,
        state: "processing",
        leaseOwner: input.owner,
      },
      data,
    });
    if (updated.count !== 1) return null;
    const current = await this.prisma.inboxMessage.findUnique({
      where: { id: input.id },
    });
    if (
      !current ||
      (current.state !== "retry_wait" && current.state !== "dead_letter")
    ) {
      return null;
    }
    return {
      messageId: current.messageId,
      state: current.state,
    };
  }

  async findById(id: string): Promise<StoredInboxDeadLetter | null> {
    const row = await this.prisma.inboxMessage.findUnique({
      where: { id },
    });
    return row ? toDeadLetter(row) : null;
  }

  async listDeadLetters(query: {
    tenantId: string;
    consumerName: string;
    after?: { deadLetteredAt: Date; id: string };
    take: number;
  }): Promise<InboxDeadLetterSummary[]> {
    const rows = await this.prisma.inboxMessage.findMany({
      where: {
        tenantId: query.tenantId,
        consumerName: query.consumerName,
        state: "dead_letter",
        deadLetteredAt: { not: null },
        ...(query.after
          ? {
              OR: [
                { deadLetteredAt: { lt: query.after.deadLetteredAt } },
                {
                  AND: [
                    { deadLetteredAt: query.after.deadLetteredAt },
                    { id: { lt: query.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ deadLetteredAt: "desc" }, { id: "desc" }],
      take: query.take,
    });
    return rows.flatMap((row) => {
      if (!row.deadLetteredAt) return [];
      return [
        {
          id: row.id,
          messageId: row.messageId,
          consumerName: row.consumerName,
          payloadRef: inboxPayloadRef(row.id),
          payloadHash: row.payloadHash,
          attemptCount: row.attemptCount,
          lastErrorCode: row.lastErrorCode,
          failureCategory: row.failureCategory,
          ownerQueue: row.ownerQueue,
          deadLetteredAt: row.deadLetteredAt,
          receivedAt: row.receivedAt,
          causationId: row.causationId,
          traceId: row.traceId,
        },
      ];
    });
  }

  async findReplayByIdempotency(input: {
    tenantId: string;
    deadLetterId: string;
    idempotencyKey: string;
  }): Promise<{
    replayedInboxId: string;
    replayedMessageId: string;
    requestHash: string | null;
  } | null> {
    const row = await this.prisma.inboxReplayRequest.findUnique({
      where: {
        tenantId_deadLetterId_idempotencyKey: {
          tenantId: input.tenantId,
          deadLetterId: input.deadLetterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (!row) return null;
    return {
      replayedInboxId: row.replayedInboxId,
      replayedMessageId: row.replayedMessageId,
      requestHash: row.requestHash,
    };
  }

  async insertReplay(input: {
    replay: InboxReceivedRecord;
    request: InboxReplayRequestDraft;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.inboxMessage.create({
        data: {
          id: input.replay.id,
          tenantId: input.replay.tenantId,
          consumerName: input.replay.consumerName,
          messageId: input.replay.messageId,
          payloadHash: input.replay.payloadHash,
          payloadJson:
            input.replay.payloadJson === undefined ||
            input.replay.payloadJson === null
              ? undefined
              : JSON.parse(JSON.stringify(input.replay.payloadJson)),
          causationId: input.replay.causationId,
          state: input.replay.state,
          attemptCount: input.replay.attemptCount,
          traceId: input.replay.traceId,
          receivedAt: input.replay.receivedAt,
        },
      });
      await tx.inboxReplayRequest.create({
        data: {
          tenantId: input.request.tenantId,
          deadLetterId: input.request.deadLetterId,
          replayedInboxId: input.request.replayedInboxId,
          replayedMessageId: input.request.replayedMessageId,
          targetConsumerVersion: input.request.targetConsumerVersion,
          requestedBy: input.request.requestedBy,
          reasonCode: input.request.reasonCode,
          requestedAt: input.request.requestedAt,
          traceId: input.request.traceId,
          idempotencyKey: input.request.idempotencyKey,
          requestHash: input.request.requestHash,
        },
      });
    });
  }
}

function toClaimed(row: ClaimRow): ClaimedInbox | null {
  if (
    row.state !== "processing" ||
    !row.locked_by ||
    !row.locked_at ||
    !row.lease_expires_at
  ) {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    consumerName: row.consumer_name,
    messageId: row.message_id,
    payloadHash: row.payload_hash,
    payloadJson: row.payload_json,
    state: "processing",
    attemptCount: Number(row.attempt_count),
    lease: {
      owner: row.locked_by,
      lockedAt: row.locked_at,
      expiresAt: row.lease_expires_at,
    },
    traceId: row.trace_id,
    receivedAt: row.received_at,
  };
}

function toDeadLetter(row: {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payloadJson: unknown;
  state: string;
  attemptCount: number;
  lastErrorCode: string | null;
  failureCategory: string | null;
  ownerQueue: string | null;
  deadLetteredAt: Date | null;
  receivedAt: Date;
  causationId: string | null;
  traceId: string;
}): StoredInboxDeadLetter | null {
  if (
    row.state !== "received" &&
    row.state !== "processing" &&
    row.state !== "processed" &&
    row.state !== "retry_wait" &&
    row.state !== "dead_letter"
  ) {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    consumerName: row.consumerName,
    messageId: row.messageId,
    payloadHash: row.payloadHash,
    payloadJson: row.payloadJson,
    state: row.state,
    attemptCount: row.attemptCount,
    lastErrorCode: row.lastErrorCode,
    failureCategory: row.failureCategory,
    ownerQueue: row.ownerQueue,
    deadLetteredAt: row.deadLetteredAt,
    receivedAt: row.receivedAt,
    causationId: row.causationId,
    traceId: row.traceId,
  };
}

function toStored(row: {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  state: string;
  attemptCount: number;
  traceId: string;
  receivedAt: Date;
}): StoredInboxMessage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consumerName: row.consumerName,
    messageId: row.messageId,
    payloadHash: row.payloadHash,
    state: row.state,
    attemptCount: row.attemptCount,
    traceId: row.traceId,
    receivedAt: row.receivedAt,
  };
}
