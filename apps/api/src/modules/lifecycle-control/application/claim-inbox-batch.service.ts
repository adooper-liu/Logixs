import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { SERVICE_ACTOR_TYPE } from "../../identity";
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

export interface ClaimInboxBatchInput {
  actorType: string;
  actorId: string;
  tenantId: string;
  consumerName: string;
  limit?: number | string;
}

export interface ClaimInboxBatchItem {
  inboxRecordId: string;
  messageId: string;
  state: "processing";
  attemptCount: number;
  leaseOwner: string;
  leaseLockedAt: string;
  leaseExpiresAt: string;
}

export interface ClaimInboxBatchResult {
  claimed: number;
  leftover: boolean;
  items: ClaimInboxBatchItem[];
}

@Injectable()
export class ClaimInboxBatchService {
  constructor(
    @Inject(INBOX_REPOSITORY)
    private readonly inbox: InboxRepository,
  ) {}

  async execute(input: ClaimInboxBatchInput): Promise<ClaimInboxBatchResult> {
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

    const claimed = await this.inbox.claimBatch({
      tenantId,
      consumerName,
      owner: input.actorId.trim(),
      now: new Date(),
      limit,
      leaseSeconds: FIRST_SLICE_INBOX_LEASE_SECONDS,
    });

    return {
      claimed: claimed.length,
      leftover: claimed.length === limit,
      items: claimed.map(toItem),
    };
  }
}

function toItem(row: ClaimedInbox): ClaimInboxBatchItem {
  return {
    inboxRecordId: row.id,
    messageId: row.messageId,
    state: row.state,
    attemptCount: row.attemptCount,
    leaseOwner: row.lease.owner,
    leaseLockedAt: row.lease.lockedAt.toISOString(),
    leaseExpiresAt: row.lease.expiresAt.toISOString(),
  };
}
