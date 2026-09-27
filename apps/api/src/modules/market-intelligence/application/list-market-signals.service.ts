import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { MarketSignalPageV1 } from "@logix/contracts";
import {
  READ_EVIDENCE_REFS,
  type ReadEvidenceRefsPort,
} from "../../document-records";
import {
  MARKET_SIGNAL_REPOSITORY,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";
import { presentMarketSignal } from "./market-signal.presenter";

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
    pageSize?: string;
    cursor?: string;
  }): Promise<MarketSignalPageV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const pageSize = parsePageSize(input.pageSize);
    const after = input.cursor
      ? decodeCursor(input.cursor, input.tenantId)
      : undefined;
    const rows = await this.repository.list({
      tenantId: input.tenantId,
      after,
      take: pageSize + 1,
    });
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
      nextCursor:
        hasNext && last
          ? encodeCursor(input.tenantId, last.updatedAt, last.id)
          : null,
    };
  }
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 50;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 100) invalid("pageSize");
  return parsed;
}

function encodeCursor(tenantId: string, updatedAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ tenantId, updatedAt: updatedAt.toISOString(), id }),
  ).toString("base64url");
}

function decodeCursor(
  value: string,
  tenantId: string,
): { updatedAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      updatedAt?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      invalid("cursor");
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) invalid("cursor");
    return { updatedAt, id: parsed.id };
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
