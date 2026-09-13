import type { DeadLetterSummary } from "./outbox-page";
import type { OutboxDeliveryDecision } from "./outbox-failure";
import type { ClaimedOutbox } from "./outbox-publish";
import type {
  ReplayOutboxDraft,
  ReplayRequestDraft,
  StoredOutboxMessage,
} from "./outbox-replay";

export const OUTBOX_REPOSITORY = Symbol("OutboxRepository");

export interface OutboxRepository {
  claimBatch(input: {
    tenantId: string;
    ownerModule: string;
    owner: string;
    now: Date;
    limit: number;
    leaseSeconds: number;
  }): Promise<ClaimedOutbox[]>;

  markPublished(input: {
    id: string;
    owner: string;
    brokerReference: string;
    publishedAt: Date;
  }): Promise<{ eventId: string; brokerReference: string } | null>;

  markDeliveryFailed(input: {
    id: string;
    owner: string;
    decision: OutboxDeliveryDecision;
  }): Promise<{
    eventId: string;
    state: OutboxDeliveryDecision["state"];
  } | null>;

  findById(id: string): Promise<StoredOutboxMessage | null>;

  findReplayByIdempotency(input: {
    tenantId: string;
    deadLetterId: string;
    idempotencyKey: string;
  }): Promise<{
    replayedOutboxId: string;
    replayedEventId: string;
    requestHash: string | null;
  } | null>;

  insertReplay(input: {
    replay: ReplayOutboxDraft;
    request: ReplayRequestDraft;
  }): Promise<void>;

  listDeadLetters(query: {
    tenantId: string;
    ownerModule: string;
    after?: { deadLetteredAt: Date; id: string };
    take: number;
  }): Promise<DeadLetterSummary[]>;

  listDueTenantIds(input: {
    ownerModule: string;
    now: Date;
    take: number;
  }): Promise<string[]>;
}
