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
      ? decodeInitiativeCursor(input.cursor, input.tenantId)
      : undefined;
    const todayUtc = cursor?.asOfDate ?? new Date();
    if (!cursor) todayUtc.setUTCHours(0, 0, 0, 0);
    // 多取一条用来判断还有没有下一页，不必再查一次 count。
    const rows = await this.repository.list({
      tenantId: input.tenantId,
      todayUtc,
      ...(cursor
        ? {
            after: {
              group: cursor.group,
              reconsiderationDate: cursor.reconsiderationDate,
              updatedAt: cursor.updatedAt,
              id: cursor.id,
            },
          }
        : {}),
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);
    return {
      contractVersion: "product-initiative-queue.v1",
      items: items.map((record) => toQueueEntry(record, todayUtc)),
      pageSize,
      nextCursor:
        hasNext && last
          ? encodeInitiativeCursor(input.tenantId, last, todayUtc)
          : null,
    };
  }
}

export function toQueueEntry(
  record: ProductInitiativeRecord,
  todayUtc = new Date(),
): ProductInitiativeQueueEntryV1 {
  const due = isReconsiderationDue(record, todayUtc);
  return {
    handoffId: record.handoffId,
    outcome: record.outcome,
    currentDestination: record.currentDestination,
    queueGroup: due ? "defer_reconsideration_due" : "standard",
    reconsiderationDate: dateOnly(record.reconsiderationDate),
    pendingFieldCodes: record.pendingFieldCodes,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isReconsiderationDue(
  record: ProductInitiativeRecord,
  todayUtc: Date,
): boolean {
  return (
    record.outcome === "defer" &&
    record.currentDestination === "deferred" &&
    record.reconsiderationDate !== null &&
    record.reconsiderationDate <= todayUtc
  );
}

function encodeInitiativeCursor(
  tenantId: string,
  record: ProductInitiativeRecord,
  todayUtc: Date,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId,
      asOfDate: dateOnly(todayUtc),
      group: isReconsiderationDue(record, todayUtc)
        ? "defer_reconsideration_due"
        : "standard",
      reconsiderationDate: dateOnly(record.reconsiderationDate),
      updatedAt: record.updatedAt.toISOString(),
      id: record.initiativeId,
    }),
  ).toString("base64url");
}

function decodeInitiativeCursor(
  value: string,
  tenantId: string,
): {
  group: "defer_reconsideration_due" | "standard";
  asOfDate: Date;
  reconsiderationDate: Date | null;
  updatedAt: Date;
  id: string;
} {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      group?: unknown;
      asOfDate?: unknown;
      reconsiderationDate?: unknown;
      updatedAt?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      (parsed.group !== "defer_reconsideration_due" &&
        parsed.group !== "standard") ||
      typeof parsed.asOfDate !== "string" ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      invalid("cursor");
    }
    const updatedAt = new Date(parsed.updatedAt);
    const asOfDate = new Date(`${parsed.asOfDate}T00:00:00.000Z`);
    const reconsiderationDate =
      typeof parsed.reconsiderationDate === "string"
        ? new Date(`${parsed.reconsiderationDate}T00:00:00.000Z`)
        : null;
    if (
      Number.isNaN(updatedAt.getTime()) ||
      Number.isNaN(asOfDate.getTime()) ||
      (reconsiderationDate && Number.isNaN(reconsiderationDate.getTime())) ||
      (parsed.group === "defer_reconsideration_due" && !reconsiderationDate)
    ) {
      invalid("cursor");
    }
    return {
      group: parsed.group as "defer_reconsideration_due" | "standard",
      asOfDate,
      reconsiderationDate,
      updatedAt,
      id: parsed.id,
    };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    invalid("cursor");
  }
}

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
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
