import type { InboxReceivedRecord } from "./inbox-message";
import type { OutboxDeliveryDecision } from "./outbox-failure";
import type { ClaimedInbox } from "./inbox-processing";
import type {
  InboxDeadLetterSummary,
  InboxReplayRequestDraft,
  StoredInboxDeadLetter,
} from "./inbox-replay";

export const INBOX_REPOSITORY = Symbol("InboxRepository");

export interface StoredInboxMessage {
  id: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  state: string;
  attemptCount: number;
  traceId: string;
  receivedAt: Date;
}

export interface InboxRepository {
  findByConsumerMessage(input: {
    consumerName: string;
    messageId: string;
  }): Promise<StoredInboxMessage | null>;

  insertReceived(record: InboxReceivedRecord): Promise<void>;

  claimBatch(input: {
    tenantId: string;
    consumerName: string;
    owner: string;
    now: Date;
    limit: number;
    leaseSeconds: number;
  }): Promise<ClaimedInbox[]>;

  markProcessed(input: {
    id: string;
    owner: string;
    processedAt: Date;
  }): Promise<{ messageId: string; processedAt: Date } | null>;

  markConsumptionFailed(input: {
    id: string;
    owner: string;
    decision: OutboxDeliveryDecision;
  }): Promise<{
    messageId: string;
    state: OutboxDeliveryDecision["state"];
  } | null>;

  findById(id: string): Promise<StoredInboxDeadLetter | null>;

  listDeadLetters(query: {
    tenantId: string;
    consumerName: string;
    after?: { deadLetteredAt: Date; id: string };
    take: number;
  }): Promise<InboxDeadLetterSummary[]>;

  findReplayByIdempotency(input: {
    tenantId: string;
    deadLetterId: string;
    idempotencyKey: string;
  }): Promise<{
    replayedInboxId: string;
    replayedMessageId: string;
    requestHash: string | null;
  } | null>;

  insertReplay(input: {
    replay: InboxReceivedRecord;
    request: InboxReplayRequestDraft;
  }): Promise<void>;
}
