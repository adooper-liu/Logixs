import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { FIRST_SLICE_INBOX_CONSUMER } from "../domain/inbox-message";
import type { InboxDeadLetterSummary } from "../domain/inbox-replay";
import {
  decodeDeadLetterCursor,
  encodeDeadLetterCursor,
  parsePageSize,
} from "../domain/outbox-page";
import {
  INBOX_REPOSITORY,
  type InboxRepository,
} from "../domain/inbox.repository";

export interface ListInboxDeadLettersInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface InboxDeadLetterPage {
  items: InboxDeadLetterSummary[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListInboxDeadLettersService {
  constructor(
    @Inject(INBOX_REPOSITORY)
    private readonly inbox: InboxRepository,
  ) {}

  async execute(
    input: ListInboxDeadLettersInput,
  ): Promise<InboxDeadLetterPage> {
    if (!input.tenantId?.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    const tenantId = input.tenantId;

    let pageSize: number;
    try {
      pageSize = parsePageSize(input.pageSize);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    let after: { deadLetteredAt: Date; id: string } | undefined;
    if (input.cursor) {
      try {
        const cursor = decodeDeadLetterCursor(input.cursor);
        if (cursor.tenantId !== tenantId) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { deadLetteredAt: cursor.deadLetteredAt, id: cursor.id };
      } catch (error) {
        throw new HttpException(
          error instanceof Error ? error.message : "VALIDATION_FORMAT",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.inbox.listDeadLetters({
      tenantId,
      consumerName: FIRST_SLICE_INBOX_CONSUMER,
      after,
      take: pageSize + 1,
    });
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;
    const last = items[items.length - 1];

    return {
      items,
      pageInfo: {
        nextCursor:
          hasNextPage && last
            ? encodeDeadLetterCursor({
                tenantId,
                deadLetteredAt: last.deadLetteredAt,
                id: last.id,
              })
            : null,
        hasNextPage,
        pageSize,
      },
      asOf: new Date(),
      projectionVersion: 0,
    };
  }
}
