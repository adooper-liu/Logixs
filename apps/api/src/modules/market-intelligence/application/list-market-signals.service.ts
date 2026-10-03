import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  MarketSignalDestinationV1,
  MarketSignalPageV1,
} from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalListCursor,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";
import { presentMarketSignal } from "./market-signal.presenter";

const DESTINATIONS = new Set<MarketSignalDestinationV1>([
  "needs_decision",
  "watching",
  "handed_off",
  "dismissed",
  "returned_from_selection",
  "voided",
  "archived",
]);

@Injectable()
export class ListMarketSignalsService {
  constructor(
    @Inject(MARKET_SIGNAL_REPOSITORY)
    private readonly repository: MarketSignalRepository,
    @Inject(READ_EVIDENCE_REFS)
    private readonly evidenceReader: ReadEvidenceRefsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    destination?: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<MarketSignalPageV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const destination = parseDestination(input.destination);
    const pageSize = parsePageSize(input.pageSize);
    const after = input.cursor
      ? decodeCursor(input.cursor, input.tenantId, destination)
      : undefined;
    const [rows, totalCount] = await Promise.all([
      this.repository.list({
        tenantId: input.tenantId,
        destination,
        after,
        take: pageSize + 1,
      }),
      destination
        ? this.repository.count({ tenantId: input.tenantId, destination })
        : undefined,
    ]);
    const hasNext = rows.length > pageSize;
    const pageRows = hasNext ? rows.slice(0, pageSize) : rows;
    const evidence = await this.evidenceReader.execute({
      tenantId: input.tenantId,
      subjectType: "market_signal",
      subjectIds: pageRows.map(({ id }) => id),
    });
    const last = pageRows.at(-1);
    return {
      contractVersion: "market-signal-page.v1",
      items: pageRows.map((row) => {
        const item = presentMarketSignal(row, evidence[row.id] ?? []);
        if (destination) return item;
        // 旧版无 destination 请求保持升级前的严格响应形状。
        const legacy = { ...item };
        delete legacy.activeValidation;
        return legacy;
      }),
      pageSize,
      ...(totalCount === undefined ? {} : { totalCount }),
      nextCursor:
        hasNext && last
          ? encodeCursor(
              input.tenantId,
              destination,
              cursorFor(destination, last),
            )
          : null,
    };
  }
}

// 不带 destination 的请求保持升级前的跨状态 updatedAt 排序与游标格式，
// 让发布窗口内仍在运行的旧页面不因新增必填参数而失败。
function parseDestination(
  value: string | undefined,
): MarketSignalDestinationV1 | undefined {
  if (value === undefined) return undefined;
  if (!DESTINATIONS.has(value as MarketSignalDestinationV1)) {
    invalid("destination");
  }
  return value as MarketSignalDestinationV1;
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 50;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 100) invalid("pageSize");
  return parsed;
}

function cursorFor(
  destination: MarketSignalDestinationV1 | undefined,
  record: Parameters<typeof presentMarketSignal>[0],
): MarketSignalListCursor {
  if (destination === "watching") {
    return {
      sort: "watching_due",
      activeValidationDueDate: record.activeValidation
        ? new Date(`${record.activeValidation.nextReviewDate}T00:00:00.000Z`)
        : null,
      updatedAt: record.updatedAt,
      id: record.id,
    };
  }
  return { sort: "updated", updatedAt: record.updatedAt, id: record.id };
}

function encodeCursor(
  tenantId: string,
  destination: MarketSignalDestinationV1 | undefined,
  cursor: MarketSignalListCursor,
): string {
  if (!destination) {
    return Buffer.from(
      JSON.stringify({
        tenantId,
        updatedAt: cursor.updatedAt.toISOString(),
        id: cursor.id,
      }),
    ).toString("base64url");
  }
  return Buffer.from(
    JSON.stringify({
      tenantId,
      destination,
      ...cursor,
      updatedAt: cursor.updatedAt.toISOString(),
      ...(cursor.sort === "watching_due"
        ? {
            activeValidationDueDate:
              cursor.activeValidationDueDate?.toISOString() ?? null,
          }
        : {}),
    }),
  ).toString("base64url");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeCursor(
  value: string,
  tenantId: string,
  destination: MarketSignalDestinationV1 | undefined,
): MarketSignalListCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      destination?: unknown;
      sort?: unknown;
      activeValidationDueDate?: unknown;
      updatedAt?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      parsed.destination !== destination ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      invalid("cursor");
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) invalid("cursor");
    if (destination === "watching") {
      if (
        parsed.sort !== "watching_due" ||
        !(
          parsed.activeValidationDueDate === null ||
          typeof parsed.activeValidationDueDate === "string"
        )
      ) {
        invalid("cursor");
      }
      const dueDate =
        parsed.activeValidationDueDate === null
          ? null
          : new Date(parsed.activeValidationDueDate);
      if (dueDate && Number.isNaN(dueDate.getTime())) invalid("cursor");
      return {
        sort: "watching_due",
        activeValidationDueDate: dueDate,
        updatedAt,
        id: parsed.id,
      };
    }
    if (parsed.sort !== (destination ? "updated" : undefined)) {
      invalid("cursor");
    }
    return { sort: "updated", updatedAt, id: parsed.id };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    invalid("cursor");
  }
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
