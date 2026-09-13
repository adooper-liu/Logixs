export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 200;

export interface DeadLetterListCursor {
  tenantId: string;
  deadLetteredAt: Date;
  id: string;
}

export interface DeadLetterSummary {
  id: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadRef: string;
  payloadHash: string;
  attemptCount: number;
  lastErrorCode: string | null;
  failureCategory: string | null;
  ownerQueue: string | null;
  deadLetteredAt: Date;
  occurredAt: Date;
  causationId: string | null;
  traceId: string;
}

export function parsePageSize(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PAGE_SIZE;
  if (!/^\d+$/.test(raw)) {
    throw new Error("VALIDATION_FORMAT: pageSize 必须是整数");
  }
  const pageSize = Number(raw);
  if (pageSize < MIN_PAGE_SIZE || pageSize > MAX_PAGE_SIZE) {
    throw new Error("VALIDATION_FORMAT: pageSize 超出 1–200");
  }
  return pageSize;
}

export function encodeDeadLetterCursor(cursor: DeadLetterListCursor): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      deadLetteredAt: cursor.deadLetteredAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeDeadLetterCursor(raw: string): DeadLetterListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      deadLetteredAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.tenantId.length === 0 ||
      typeof parsed.deadLetteredAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const deadLetteredAt = new Date(parsed.deadLetteredAt);
    if (Number.isNaN(deadLetteredAt.getTime())) throw new Error("invalid");
    return { tenantId: parsed.tenantId, deadLetteredAt, id: parsed.id };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
