import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { SERVICE_ACTOR_TYPE } from "../../identity";
import { decideInboxFailure } from "../domain/inbox-failure";
import { parseInboxConsumerName } from "../domain/inbox-message";
import {
  FIRST_SLICE_INBOX_LEASE_SECONDS,
  parseInboxClaimLimit,
  type ClaimedInbox,
} from "../domain/inbox-processing";
import {
  INBOX_REPOSITORY,
  type InboxRepository,
} from "../domain/inbox.repository";

export const INBOX_CONSUMPTION = Symbol("InboxConsumption");

export interface InboxConsumptionPort {
  consume(message: ClaimedInbox): Promise<void>;
}

export interface ProcessInboxBatchInput {
  actorType: string;
  actorId: string;
  tenantId: string;
  consumerName: string;
  limit?: number | string;
}

export interface ProcessInboxBatchItem {
  inboxRecordId: string;
  messageId: string;
  state: "processed" | "processing" | "retry_wait" | "dead_letter";
  processedAt: string | null;
  lastErrorCode: string | null;
}

export interface ProcessInboxBatchResult {
  claimed: number;
  processed: number;
  retryWait: number;
  deadLetter: number;
  leftover: number;
  items: ProcessInboxBatchItem[];
}

@Injectable()
export class ProcessInboxBatchService {
  constructor(
    @Inject(INBOX_REPOSITORY)
    private readonly inbox: InboxRepository,
    @Inject(INBOX_CONSUMPTION)
    private readonly consumption: InboxConsumptionPort,
  ) {}

  async execute(
    input: ProcessInboxBatchInput,
  ): Promise<ProcessInboxBatchResult> {
    if (input.actorType !== SERVICE_ACTOR_TYPE || !input.actorId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 需要服务身份",
        HttpStatus.FORBIDDEN,
      );
    }

    const tenantId = input.tenantId.trim();
    if (!tenantId) {
      throw new HttpException(
        "VALIDATION_FORMAT: tenantId 无效",
        HttpStatus.BAD_REQUEST,
      );
    }

    let consumerName: string;
    let limit: number;
    try {
      consumerName = parseInboxConsumerName(input.consumerName);
      limit = parseInboxClaimLimit(input.limit);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const owner = input.actorId.trim();
    const claimed = await this.inbox.claimBatch({
      tenantId,
      consumerName,
      owner,
      now: new Date(),
      limit,
      leaseSeconds: FIRST_SLICE_INBOX_LEASE_SECONDS,
    });

    const items: ProcessInboxBatchItem[] = [];
    for (const row of claimed) {
      try {
        await this.consumption.consume(row);
        const processed = await this.inbox.markProcessed({
          id: row.id,
          owner,
          processedAt: new Date(),
        });
        if (processed) {
          items.push({
            inboxRecordId: row.id,
            messageId: processed.messageId,
            state: "processed",
            processedAt: processed.processedAt.toISOString(),
            lastErrorCode: null,
          });
        } else {
          items.push(leftoverItem(row));
        }
      } catch (error) {
        const decision = decideInboxFailure({
          attemptCount: row.attemptCount,
          receivedAt: row.receivedAt,
          now: new Date(),
          error,
        });
        const marked = await this.inbox.markConsumptionFailed({
          id: row.id,
          owner,
          decision,
        });
        if (marked) {
          items.push({
            inboxRecordId: row.id,
            messageId: marked.messageId,
            state: marked.state,
            processedAt: null,
            lastErrorCode: decision.lastErrorCode,
          });
        } else {
          items.push(leftoverItem(row, decision.lastErrorCode));
        }
      }
    }

    return {
      claimed: claimed.length,
      processed: items.filter((item) => item.state === "processed").length,
      retryWait: items.filter((item) => item.state === "retry_wait").length,
      deadLetter: items.filter((item) => item.state === "dead_letter").length,
      leftover: items.filter((item) => item.state === "processing").length,
      items,
    };
  }
}

function leftoverItem(
  row: ClaimedInbox,
  lastErrorCode: string | null = null,
): ProcessInboxBatchItem {
  return {
    inboxRecordId: row.id,
    messageId: row.messageId,
    state: "processing",
    processedAt: null,
    lastErrorCode,
  };
}
