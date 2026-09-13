import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  decodeDeadLetterCursor,
  encodeDeadLetterCursor,
  parsePageSize,
  type DeadLetterSummary,
} from "../domain/outbox-page";
import { lifecycleOutboxOwnerModule } from "../domain/outbox-publish";
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from "../domain/outbox.repository";

export interface ListDeadLettersInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface DeadLetterPage {
  items: DeadLetterSummary[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListDeadLettersService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outbox: OutboxRepository,
  ) {}

  async execute(input: ListDeadLettersInput): Promise<DeadLetterPage> {
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

    const rows = await this.outbox.listDeadLetters({
      tenantId,
      ownerModule: lifecycleOutboxOwnerModule(),
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
