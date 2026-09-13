import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  CLIENT_OPERATION_REPOSITORY,
  type ClientOperationRepository,
} from "../domain/client-operation.repository";
import type { CompensationRecord } from "../domain/compensation";
import {
  decodeCompensationCursor,
  encodeCompensationCursor,
} from "../domain/compensation-page";
import {
  COMPENSATION_REPOSITORY,
  type CompensationRepository,
} from "../domain/compensation.repository";
import { parsePageSize } from "../domain/outbox-page";

export interface ListCompensationsInput {
  originalClientOperationId: string;
  tenantId?: string;
  pageSize?: string;
  cursor?: string;
}

export interface CompensationPage {
  items: CompensationRecord[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    pageSize: number;
  };
  asOf: Date;
  projectionVersion: number;
}

@Injectable()
export class ListCompensationsService {
  constructor(
    @Inject(CLIENT_OPERATION_REPOSITORY)
    private readonly operations: ClientOperationRepository,
    @Inject(COMPENSATION_REPOSITORY)
    private readonly compensations: CompensationRepository,
  ) {}

  async execute(input: ListCompensationsInput): Promise<CompensationPage> {
    const tenantId = input.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    const originalId = input.originalClientOperationId.trim();
    const original = await this.operations.findById(originalId);
    if (!original || original.tenantId !== tenantId) {
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

    let after: { createdAt: Date; id: string } | undefined;
    if (input.cursor) {
      try {
        const cursor = decodeCompensationCursor(input.cursor);
        if (
          cursor.tenantId !== tenantId ||
          cursor.originalClientOperationId !== original.id
        ) {
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

    const rows = await this.compensations.listByOriginal({
      tenantId,
      originalClientOperationId: original.id,
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
            ? encodeCompensationCursor({
                tenantId,
                originalClientOperationId: original.id,
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
