import type { LifecycleDateFactRecord } from "./lifecycle-date-fact";

export const DEFAULT_DATE_REVIEW_PAGE_SIZE = 30;
export const MAX_DATE_REVIEW_PAGE_SIZE = 100;

export interface LifecycleDateReviewCursor {
  tenantId: string;
  recordedAt: Date;
  id: string;
}

export interface LifecycleDateReviewCandidate {
  fact: LifecycleDateFactRecord;
  orderNumber: string | null;
  containerNumber: string | null;
  currentProjectionVersion: number;
}

export function parseDateReviewPageSize(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_DATE_REVIEW_PAGE_SIZE;
  if (!/^\d+$/.test(raw)) {
    throw new Error("VALIDATION_FORMAT: pageSize 必须是整数");
  }
  const value = Number(raw);
  if (value < 1 || value > MAX_DATE_REVIEW_PAGE_SIZE) {
    throw new Error("VALIDATION_FORMAT: pageSize 超出 1–100");
  }
  return value;
}

export function encodeDateReviewCursor(
  cursor: LifecycleDateReviewCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      recordedAt: cursor.recordedAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeDateReviewCursor(raw: string): LifecycleDateReviewCursor {
  try {
    const value = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as { tenantId?: unknown; recordedAt?: unknown; id?: unknown };
    if (
      typeof value.tenantId !== "string" ||
      !value.tenantId ||
      typeof value.recordedAt !== "string" ||
      typeof value.id !== "string" ||
      !value.id
    ) {
      throw new Error("invalid");
    }
    const recordedAt = new Date(value.recordedAt);
    if (Number.isNaN(recordedAt.getTime())) throw new Error("invalid");
    return { tenantId: value.tenantId, recordedAt, id: value.id };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
