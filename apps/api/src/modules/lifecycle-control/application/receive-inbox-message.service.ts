import { randomUUID } from "node:crypto";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { SERVICE_ACTOR_TYPE } from "../../identity";
import {
  assertInboxPayloadHash,
  parseInboxMessagePayload,
} from "../domain/inbox-apply-payload";
import {
  buildInboxReceived,
  decideInboxIdempotency,
} from "../domain/inbox-message";
import {
  INBOX_REPOSITORY,
  type InboxRepository,
  type StoredInboxMessage,
} from "../domain/inbox.repository";

export interface ReceiveInboxMessageInput {
  actorType: string;
  actorId: string;
  tenantId: string;
  consumerName: string;
  messageId: string;
  payloadHash: string;
  payload: unknown;
  traceId: string;
}

export interface ReceiveInboxMessageResult {
  inboxRecordId: string;
  messageId: string;
  state: string;
  applied: boolean;
}

@Injectable()
export class ReceiveInboxMessageService {
  constructor(
    @Inject(INBOX_REPOSITORY)
    private readonly inbox: InboxRepository,
  ) {}

  async execute(
    input: ReceiveInboxMessageInput,
  ): Promise<ReceiveInboxMessageResult> {
    if (input.actorType !== SERVICE_ACTOR_TYPE || !input.actorId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 需要服务身份",
        HttpStatus.FORBIDDEN,
      );
    }

    let record;
    try {
      const payload = parseInboxMessagePayload(input.payload);
      const payloadHash = assertInboxPayloadHash(payload, input.payloadHash);
      record = buildInboxReceived({
        id: randomUUID(),
        tenantId: input.tenantId,
        consumerName: input.consumerName,
        messageId: input.messageId,
        payloadHash,
        payloadJson:
          "kind" in payload
            ? payload
            : {
                containerId: payload.containerId,
                eventCode: payload.eventCode,
                occurredAt: payload.occurredAt.toISOString(),
                evidenceRefs: payload.evidenceRefs,
                idempotencyKey: payload.idempotencyKey,
              },
        traceId: input.traceId,
        receivedAt: new Date(),
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.inbox.findByConsumerMessage({
      consumerName: record.consumerName,
      messageId: record.messageId,
    });
    if (existing) {
      return reuseOrConflict(existing, record.payloadHash);
    }

    try {
      await this.inbox.insertReceived(record);
    } catch {
      const raced = await this.inbox.findByConsumerMessage({
        consumerName: record.consumerName,
        messageId: record.messageId,
      });
      if (raced) return reuseOrConflict(raced, record.payloadHash);
      throw new HttpException(
        "INTERNAL_ERROR",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      inboxRecordId: record.id,
      messageId: record.messageId,
      state: record.state,
      applied: true,
    };
  }
}

function reuseOrConflict(
  existing: StoredInboxMessage,
  incomingHash: string,
): ReceiveInboxMessageResult {
  if (
    decideInboxIdempotency(existing.payloadHash, incomingHash) === "conflict"
  ) {
    throw new HttpException(
      "IDEMPOTENCY_CONFLICT: 同键异载荷",
      HttpStatus.CONFLICT,
    );
  }
  return {
    inboxRecordId: existing.id,
    messageId: existing.messageId,
    state: existing.state,
    applied: false,
  };
}
