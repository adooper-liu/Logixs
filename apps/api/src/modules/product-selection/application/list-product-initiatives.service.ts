import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  ProductInitiativeQueueEntryV1,
  ProductInitiativeQueuePageV1,
} from "@logix/contracts";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRecord,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { decodeKeysetCursor, encodeKeysetCursor } from "./keyset-cursor";

/**
 * 选品队列需要的立项投影：让岗位一眼分出"还没看过"和"看过但先放着"。
 *
 * 只回列表要用的字段。某个交不在 items 里就是"还没看过"；在的话按
 * `currentDestination` 与 `pendingFieldCodes` 区分"已关闭"与"保存在待补里"。
 */
@Injectable()
export class ListProductInitiativesService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ProductInitiativeQueuePageV1> {
    if (!input.tenantId)
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    const pageSize = parsePageSize(input.pageSize);
    const cursor = input.cursor
      ? decodeKeysetCursor(input.cursor, input.tenantId)
      : undefined;
    // 多取一条用来判断还有没有下一页，不必再查一次 count。
    const rows = await this.repository.list({
      tenantId: input.tenantId,
      ...(cursor ? { after: { updatedAt: cursor.at, id: cursor.id } } : {}),
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    return {
      contractVersion: "product-initiative-queue.v1",
      items: items.map(toQueueEntry),
      pageSize,
      nextCursor:
        hasNext && last
          ? encodeKeysetCursor(
              input.tenantId,
              last.updatedAt,
              last.initiativeId,
            )
          : null,
    };
  }
}

export function toQueueEntry(
  record: ProductInitiativeRecord,
): ProductInitiativeQueueEntryV1 {
  return {
    handoffId: record.handoffId,
    outcome: record.outcome,
    currentDestination: record.currentDestination,
    pendingFieldCodes: record.pendingFieldCodes,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 100;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 200) invalid("pageSize");
  return parsed;
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
