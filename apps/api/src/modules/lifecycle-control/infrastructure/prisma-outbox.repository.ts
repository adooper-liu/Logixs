import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { DeadLetterSummary } from "../domain/outbox-page";
import type { OutboxDeliveryDecision } from "../domain/outbox-failure";
import type {
  ClaimedOutbox,
  OutboxPublishState,
} from "../domain/outbox-publish";
import type {
  ReplayOutboxDraft,
  ReplayRequestDraft,
  StoredOutboxMessage,
} from "../domain/outbox-replay";
import {
  beginOutboxPublishing,
  completeOutboxPublished,
} from "../domain/outbox-publish";
import type { OutboxRepository } from "../domain/outbox.repository";

type ClaimRow = {
  id: string;
  tenant_id: string;
  owner_module: string;
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload_ref: string;
  payload_hash: string;
  state: string;
  attempt_count: number | bigint;
  locked_by: string | null;
  locked_at: Date | null;
  lease_expires_at: Date | null;
  occurred_at: Date;
  created_at: Date;
  idempotency_key: string;
  trace_id: string;
};

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async claimBatch(input: {
    tenantId: string;
    ownerModule: string;
    owner: string;
    now: Date;
    limit: number;
    leaseSeconds: number;
  }): Promise<ClaimedOutbox[]> {
    const publishing = beginOutboxPublishing({
      attemptCount: 0,
      owner: input.owner,
      now: input.now,
      leaseSeconds: input.leaseSeconds,
    });
    const rows = await this.prisma.$queryRaw<ClaimRow[]>`
      UPDATE "outbox_message" AS o
      SET
        "state" = 'publishing',
        "locked_by" = ${publishing.lease.owner},
        "locked_at" = ${publishing.lease.lockedAt},
        "lease_expires_at" = ${publishing.lease.expiresAt},
        "attempt_count" = o."attempt_count" + 1,
        "updated_at" = ${input.now}
      WHERE o."id" IN (
        SELECT c."id"
        FROM "outbox_message" AS c
        WHERE c."tenant_id" = ${input.tenantId}
          AND c."owner_module" = ${input.ownerModule}
          AND (
            c."state" IN ('pending', 'retry_wait')
            OR (
              c."state" = 'publishing'
              AND (
                c."lease_expires_at" IS NULL
                OR c."lease_expires_at" <= ${input.now}
              )
            )
          )
          AND (
            c."next_attempt_at" IS NULL
            OR c."next_attempt_at" <= ${input.now}
          )
        ORDER BY c."next_attempt_at" ASC NULLS FIRST, c."created_at" ASC
        LIMIT ${input.limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        o."id",
        o."tenant_id",
        o."owner_module",
        o."event_id",
        o."event_type",
        o."aggregate_type",
        o."aggregate_id",
        o."payload_ref",
        o."payload_hash",
        o."state",
        o."attempt_count",
        o."locked_by",
        o."locked_at",
        o."lease_expires_at",
        o."occurred_at",
        o."created_at",
        o."idempotency_key",
        o."trace_id"
    `;
    return rows.flatMap((row) => {
      const claimed = toClaimed(row);
      return claimed ? [claimed] : [];
    });
  }

  async markPublished(input: {
    id: string;
    owner: string;
    brokerReference: string;
    publishedAt: Date;
  }): Promise<{ eventId: string; brokerReference: string } | null> {
    const published = completeOutboxPublished({
      brokerReference: input.brokerReference,
      publishedAt: input.publishedAt,
    });
    const updated = await this.prisma.outboxMessage.updateMany({
      where: {
        id: input.id,
        state: "publishing",
        leaseOwner: input.owner,
      },
      data: {
        state: published.state,
        brokerReference: published.brokerReference,
        publishedAt: published.publishedAt,
        leaseOwner: null,
        leaseLockedAt: null,
        leaseExpiresAt: null,
      },
    });
    const current = await this.prisma.outboxMessage.findUnique({
      where: { id: input.id },
    });
    if (!current) return null;
    if (updated.count === 1 || current.state === "published") {
      if (!current.brokerReference) return null;
      return {
        eventId: current.eventId,
        brokerReference: current.brokerReference,
      };
    }
    return null;
  }

  async markDeliveryFailed(input: {
    id: string;
    owner: string;
    decision: OutboxDeliveryDecision;
  }): Promise<{
    eventId: string;
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
    const updated = await this.prisma.outboxMessage.updateMany({
      where: {
        id: input.id,
        state: "publishing",
        leaseOwner: input.owner,
      },
      data,
    });
    if (updated.count !== 1) return null;
    const current = await this.prisma.outboxMessage.findUnique({
      where: { id: input.id },
    });
    if (
      !current ||
      (current.state !== "retry_wait" && current.state !== "dead_letter")
    ) {
      return null;
    }
    return {
      eventId: current.eventId,
      state: current.state,
    };
  }

  async findById(id: string): Promise<StoredOutboxMessage | null> {
    const row = await this.prisma.outboxMessage.findUnique({ where: { id } });
    return row ? toStored(row) : null;
  }

  async findReplayByIdempotency(input: {
    tenantId: string;
    deadLetterId: string;
    idempotencyKey: string;
  }): Promise<{
    replayedOutboxId: string;
    replayedEventId: string;
    requestHash: string | null;
  } | null> {
    const request = await this.prisma.outboxReplayRequest.findUnique({
      where: {
        tenantId_deadLetterId_idempotencyKey: {
          tenantId: input.tenantId,
          deadLetterId: input.deadLetterId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (!request) return null;
    const replayed = await this.prisma.outboxMessage.findUnique({
      where: { id: request.replayedOutboxId },
    });
    if (!replayed) return null;
    return {
      replayedOutboxId: replayed.id,
      replayedEventId: replayed.eventId,
      requestHash: request.requestHash,
    };
  }

  async insertReplay(input: {
    replay: ReplayOutboxDraft;
    request: ReplayRequestDraft;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.outboxMessage.create({
        data: {
          id: input.replay.id,
          tenantId: input.replay.tenantId,
          ownerModule: input.replay.ownerModule,
          eventId: input.replay.eventId,
          eventType: input.replay.eventType,
          eventVersion: input.replay.eventVersion,
          aggregateType: input.replay.aggregateType,
          aggregateId: input.replay.aggregateId,
          payloadRef: input.replay.payloadRef,
          payloadHash: input.replay.payloadHash,
          causationId: input.replay.causationId,
          state: input.replay.state,
          attemptCount: input.replay.attemptCount,
          occurredAt: input.replay.occurredAt,
          idempotencyKey: input.replay.idempotencyKey,
          traceId: input.replay.traceId,
        },
      });
      await tx.outboxReplayRequest.create({
        data: {
          tenantId: input.request.tenantId,
          deadLetterId: input.request.deadLetterId,
          replayedOutboxId: input.request.replayedOutboxId,
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

  async listDeadLetters(query: {
    tenantId: string;
    ownerModule: string;
    after?: { deadLetteredAt: Date; id: string };
    take: number;
  }): Promise<DeadLetterSummary[]> {
    const rows = await this.prisma.outboxMessage.findMany({
      where: {
        tenantId: query.tenantId,
        ownerModule: query.ownerModule,
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
          eventId: row.eventId,
          eventType: row.eventType,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          payloadRef: row.payloadRef,
          payloadHash: row.payloadHash,
          attemptCount: row.attemptCount,
          lastErrorCode: row.lastErrorCode,
          failureCategory: row.failureCategory,
          ownerQueue: row.ownerQueue,
          deadLetteredAt: row.deadLetteredAt,
          occurredAt: row.occurredAt,
          causationId: row.causationId,
          traceId: row.traceId,
        },
      ];
    });
  }

  async listDueTenantIds(input: {
    ownerModule: string;
    now: Date;
    take: number;
  }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ tenant_id: string }[]>`
      SELECT DISTINCT c."tenant_id"
      FROM "outbox_message" AS c
      WHERE c."owner_module" = ${input.ownerModule}
        AND (
          c."state" IN ('pending', 'retry_wait')
          OR (
            c."state" = 'publishing'
            AND (
              c."lease_expires_at" IS NULL
              OR c."lease_expires_at" <= ${input.now}
            )
          )
        )
        AND (
          c."next_attempt_at" IS NULL
          OR c."next_attempt_at" <= ${input.now}
        )
      ORDER BY c."tenant_id" ASC
      LIMIT ${input.take}
    `;
    return rows.map((row) => row.tenant_id);
  }
}

function toClaimed(row: ClaimRow): ClaimedOutbox | null {
  if (
    row.state !== "publishing" ||
    !row.locked_by ||
    !row.locked_at ||
    !row.lease_expires_at
  ) {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ownerModule: row.owner_module,
    eventId: row.event_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payloadRef: row.payload_ref,
    payloadHash: row.payload_hash,
    state: "publishing",
    attemptCount: Number(row.attempt_count),
    lease: {
      owner: row.locked_by,
      lockedAt: row.locked_at,
      expiresAt: row.lease_expires_at,
    },
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    idempotencyKey: row.idempotency_key,
    traceId: row.trace_id,
  };
}

function toStored(row: {
  id: string;
  tenantId: string;
  ownerModule: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  state: string;
  attemptCount: number;
  occurredAt: Date;
  idempotencyKey: string;
  causationId: string | null;
  traceId: string;
}): StoredOutboxMessage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ownerModule: row.ownerModule,
    eventId: row.eventId,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payloadRef: row.payloadRef,
    payloadHash: row.payloadHash,
    state: row.state as OutboxPublishState,
    attemptCount: row.attemptCount,
    occurredAt: row.occurredAt,
    idempotencyKey: row.idempotencyKey,
    causationId: row.causationId,
    traceId: row.traceId,
  };
}
