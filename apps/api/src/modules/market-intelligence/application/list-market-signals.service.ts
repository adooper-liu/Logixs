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
      this.repository.count({ tenantId: input.tenantId, destination }),
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
      items: pageRows.map((row) =>
        presentMarketSignal(row, evidence[row.id] ?? []),
      ),
      pageSize,
      totalCount,
      nextCursor:
        hasNext && last
          ? encodeCursor(input.tenantId, destination, cursorFor(last))
          : null,
    };
  }
}

function parseDestination(value: string | undefined): MarketSignalDestinationV1 {
  if (!value || !DESTINATIONS.has(value as MarketSignalDestinationV1)) {
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

function cursorFor(record: Parameters<typeof presentMarketSignal>[0]): MarketSignalListCursor {
  if (record.currentDestination === "watching") {
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
  destination: MarketSignalDestinationV1,
  cursor: MarketSignalListCursor,
): string {
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

function decodeCursor(
  value: string,
  tenantId: string,
  destination: MarketSignalDestinationV1,
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
      !parsed.id
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
    if (parsed.sort !== "updated") invalid("cursor");
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
