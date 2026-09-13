import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  decodeLifecycleEventCursor,
  encodeLifecycleEventCursor,
} from "../domain/lifecycle-event-page";
import type { CanonicalEventListItem } from "../domain/lifecycle.repository";
import {
  LIFECYCLE_REPOSITORY,
  type LifecycleRepository,
} from "../domain/lifecycle.repository";
import { parsePageSize } from "../domain/outbox-page";

export interface ListLifecycleEventsInput {
  containerId: string;
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface LifecycleEventPage {
  items: CanonicalEventListItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListLifecycleEventsService {
  constructor(
    @Inject(LIFECYCLE_REPOSITORY)
    private readonly repository: LifecycleRepository,
  ) {}

  async execute(input: ListLifecycleEventsInput): Promise<LifecycleEventPage> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    const containerId = input.containerId.trim();
    if (!containerId) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }
    const container = await this.repository.findContainerBase(containerId);
    if (!container || container.tenantId !== tenantId) {
      throw new HttpException("RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    let pageSize: number;
    try {
      pageSize = parsePageSize(input.pageSize);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    let after: { occurredAt: Date; id: string } | undefined;
    if (input.cursor) {
      try {
        const cursor = decodeLifecycleEventCursor(input.cursor);
        if (
          cursor.tenantId !== tenantId ||
          cursor.containerId !== containerId
        ) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { occurredAt: cursor.occurredAt, id: cursor.id };
      } catch (error) {
        throw new HttpException(
          error instanceof Error ? error.message : "VALIDATION_FORMAT",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.repository.listEvents({
      containerId,
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
            ? encodeLifecycleEventCursor({
                tenantId,
                containerId,
                occurredAt: last.occurredAt,
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
