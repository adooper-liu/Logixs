import type { ErrorCategory, ErrorDetail } from "@logix/contracts";

export interface ParsedHttpErrorResponse {
  code: string | null;
  category: ErrorCategory | null;
  retryable: boolean | null;
  message: string;
  details: ErrorDetail[];
  traceId: string | null;
}

export function parseHttpErrorResponse(text: string): ParsedHttpErrorResponse {
  const trimmed = text.trim();
  if (!trimmed) return emptyParsedError("");
  try {
    const body = JSON.parse(trimmed) as {
      message?: unknown;
      error?: unknown;
      traceId?: unknown;
    };
    const nested = isRecord(body.error) ? body.error : null;
    const rawMessage = nested?.message ?? body.message ?? body.error;
    return {
      code:
        typeof nested?.code === "string" && nested.code.trim()
          ? nested.code.trim()
          : null,
      category: errorCategory(nested?.category),
      retryable:
        typeof nested?.retryable === "boolean" ? nested.retryable : null,
      message: displayMessage(rawMessage),
      details: errorDetails(nested?.details),
      traceId:
        typeof body.traceId === "string" && body.traceId.trim()
          ? body.traceId.trim()
          : null,
    };
  } catch {
    return emptyParsedError(trimmed);
  }
}

export function parseHttpErrorDetail(text: string): string {
  return parseHttpErrorResponse(text).message;
}

export function formatHttpError(
  status: number,
  body: string,
  fallback: string,
): string {
  const detail = parseHttpErrorDetail(body).slice(0, 500);
  return detail
    ? `${fallback}（${status}）：${detail}`
    : `${fallback}（${status}）`;
}

function displayMessage(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join("；");
  }
  return typeof value === "string" ? value.trim() : "";
}

function errorDetails(value: unknown): ErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.reasonCode !== "string" ||
      !item.reasonCode.trim() ||
      typeof item.message !== "string" ||
      !item.message.trim()
    ) {
      return [];
    }
    return [
      {
        reasonCode: item.reasonCode.trim(),
        message: item.message.trim(),
        ...(typeof item.field === "string" ? { field: item.field } : {}),
        ...(typeof item.rejectedValueSummary === "string"
          ? { rejectedValueSummary: item.rejectedValueSummary }
          : {}),
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ERROR_CATEGORIES = new Set<ErrorCategory>([
  "validation",
  "authentication",
  "authorization",
  "not_found",
  "conflict",
  "precondition",
  "rate_limit",
  "dependency",
  "internal",
]);

function errorCategory(value: unknown): ErrorCategory | null {
  return typeof value === "string" &&
    ERROR_CATEGORIES.has(value as ErrorCategory)
    ? (value as ErrorCategory)
    : null;
}

function emptyParsedError(message: string): ParsedHttpErrorResponse {
  return {
    code: null,
    category: null,
    retryable: null,
    message,
    details: [],
    traceId: null,
  };
}
