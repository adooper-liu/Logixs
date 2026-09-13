import type { InboxReceivedRecord } from "./inbox-message";
import type { OutboxDeliveryDecision } from "./outbox-failure";
import type { ClaimedInbox } from "./inbox-processing";

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
  }): Promise<{ messageId: string; state: OutboxDeliveryDecision["state"] } | null>;
}
