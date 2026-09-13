import type { DeadLetterItem } from "../api/deadLetters";

export const DEAD_LETTER_COLUMN_KEYS = [
  "eventType",
  "objectRef",
  "failureSummary",
  "attemptCount",
  "payloadRef",
  "deadLetteredAt",
] as const;

export const DEAD_LETTER_FORBIDDEN_RENDER_KEYS = [
  "payload",
  "payloadBody",
  "token",
  "cookie",
  "serviceKey",
  "password",
] as const;

export interface DeadLetterRow {
  id: string;
  eventType: string;
  objectRef: string;
  failureSummary: string;
  attemptCount: number;
  payloadRef: string;
  deadLetteredAt: string;
}

export function toDeadLetterRow(item: DeadLetterItem): DeadLetterRow {
  const failure = [item.lastErrorCode, item.failureCategory]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
  return {
    id: item.id,
    eventType: item.eventType,
    objectRef: `${item.aggregateType}/${item.aggregateId}`,
    failureSummary: failure || "未分类失败",
    attemptCount: item.attemptCount,
    payloadRef: item.payloadRef,
    deadLetteredAt: item.deadLetteredAt,
  };
}

export function assertDeadLetterRowSafe(row: DeadLetterRow): void {
  const serialized = JSON.stringify(row);
  for (const key of DEAD_LETTER_FORBIDDEN_RENDER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      throw new Error(`死信行不得包含 ${key}`);
    }
  }
  if (
    /"payload"\s*:/.test(serialized) ||
    /serviceKey|Bearer /.test(serialized)
  ) {
    throw new Error("死信行不得包含载荷正文或凭据");
  }
}
