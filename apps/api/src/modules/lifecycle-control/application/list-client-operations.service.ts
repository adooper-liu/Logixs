import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  decodeClientOperationCursor,
  encodeClientOperationCursor,
} from "../domain/client-operation-page";
import {
  CLIENT_OPERATION_REPOSITORY,
  type ClientOperationListItem,
  type ClientOperationRepository,
} from "../domain/client-operation.repository";
import { parsePageSize } from "../domain/outbox-page";

export interface ListClientOperationsInput {
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface ClientOperationPage {
  items: ClientOperationListItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListClientOperationsService {
  constructor(
    @Inject(CLIENT_OPERATION_REPOSITORY)
    private readonly operations: ClientOperationRepository,
  ) {}

  async execute(
    input: ListClientOperationsInput,
  ): Promise<ClientOperationPage> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
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

    let after: { createdAt: Date; id: string } | undefined;
    if (input.cursor) {
      try {
        const cursor = decodeClientOperationCursor(input.cursor);
        if (cursor.tenantId !== tenantId) {
          throw new Error("VALIDATION_FORMAT: cursor 与过滤条件不匹配");
        }
        after = { createdAt: cursor.createdAt, id: cursor.id };
      } catch (error) {
        throw new HttpException(
          error instanceof Error ? error.message : "VALIDATION_FORMAT",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rows = await this.operations.listByTenant({
      tenantId,
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
            ? encodeClientOperationCursor({
                tenantId,
                createdAt: last.createdAt,
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
