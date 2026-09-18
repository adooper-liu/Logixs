import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  POST_NOTIFICATION,
  type PostNotificationPort,
} from "../../notification";
import { decideOutboxFailure } from "../domain/outbox-failure";
import type { ClaimedOutbox } from "../domain/outbox-publish";
import {
  FIRST_SLICE_PUBLISH_LEASE_SECONDS,
  lifecycleOutboxOwnerModule,
  parsePublishBatchLimit,
} from "../domain/outbox-publish";
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from "../domain/outbox.repository";

export const OUTBOX_DELIVERY = Symbol("OutboxDelivery");

export interface OutboxDeliveryPort {
  deliver(message: ClaimedOutbox): Promise<{ brokerReference: string }>;
}

export interface PublishOutboxBatchInput {
  tenantId: string;
  operatorId: string;
  limit?: number | string;
}

export interface PublishOutboxBatchItem {
  eventId: string;
  state: "published" | "publishing" | "retry_wait" | "dead_letter";
  brokerReference: string | null;
  lastErrorCode: string | null;
}

export interface PublishOutboxBatchResult {
  claimed: number;
  published: number;
  retryWait: number;
  deadLetter: number;
  leftover: number;
  items: PublishOutboxBatchItem[];
}

@Injectable()
export class PublishOutboxBatchService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outbox: OutboxRepository,
    @Inject(OUTBOX_DELIVERY)
    private readonly delivery: OutboxDeliveryPort,
    @Inject(POST_NOTIFICATION)
    private readonly postNotification: PostNotificationPort,
  ) {}

  async execute(
    input: PublishOutboxBatchInput,
  ): Promise<PublishOutboxBatchResult> {
    if (!input.tenantId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    if (!input.operatorId.trim()) {
      throw new HttpException(
        "AUTHENTICATION_REQUIRED",
        HttpStatus.UNAUTHORIZED,
      );
    }

    let limit: number;
    try {
      limit = parsePublishBatchLimit(input.limit);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    const claimed = await this.outbox.claimBatch({
      tenantId: input.tenantId,
      ownerModule: lifecycleOutboxOwnerModule(),
      owner: input.operatorId,
      now,
      limit,
      leaseSeconds: FIRST_SLICE_PUBLISH_LEASE_SECONDS,
    });

    const items: PublishOutboxBatchItem[] = [];
    for (const row of claimed) {
      try {
        const delivered = await this.delivery.deliver(row);
        const published = await this.outbox.markPublished({
          id: row.id,
          owner: input.operatorId,
          brokerReference: delivered.brokerReference,
          publishedAt: new Date(),
        });
        if (published) {
          items.push({
            eventId: published.eventId,
            state: "published",
            brokerReference: published.brokerReference,
            lastErrorCode: null,
          });
        } else {
          items.push(leftoverItem(row.eventId));
        }
      } catch (error) {
        const decision = decideOutboxFailure({
          attemptCount: row.attemptCount,
          createdAt: row.createdAt,
          now: new Date(),
          error,
        });
        const marked = await this.outbox.markDeliveryFailed({
          id: row.id,
          owner: input.operatorId,
          decision,
        });
        if (marked) {
          items.push({
            eventId: marked.eventId,
            state: marked.state,
            brokerReference: null,
            lastErrorCode: decision.lastErrorCode,
          });
          if (marked.state === "dead_letter") {
            await this.postNotification.execute({
              tenantId: row.tenantId,
              problemCode: "outbox_dead_letter",
              severity: "high",
              title: "出站消息进入死信",
              body: `事件 ${marked.eventId}（${row.eventType}）投递失败并进入死信。错误码：${decision.lastErrorCode ?? "unknown"}。`,
              entityType: "outbox_message",
              entityId: row.id,
              occurredAt: new Date(),
              recipientRoleCodes: [
                "operations_dispatcher",
                "review_supervisor",
              ],
              conversationHint: `请在看失败队列定位死信 ${row.id}，核对后按授权重放。`,
            });
          }
        } else {
          items.push(leftoverItem(row.eventId, decision.lastErrorCode));
        }
      }
    }

    return summarizeBatch(claimed.length, items);
  }
}

function leftoverItem(
  eventId: string,
  lastErrorCode: string | null = null,
): PublishOutboxBatchItem {
  return {
    eventId,
    state: "publishing",
    brokerReference: null,
    lastErrorCode,
  };
}

function summarizeBatch(
  claimed: number,
  items: PublishOutboxBatchItem[],
): PublishOutboxBatchResult {
  return {
    claimed,
    published: items.filter((item) => item.state === "published").length,
    retryWait: items.filter((item) => item.state === "retry_wait").length,
    deadLetter: items.filter((item) => item.state === "dead_letter").length,
    leftover: items.filter((item) => item.state === "publishing").length,
    items,
  };
}
