export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 200;

export interface TaskListCursor {
  containerId?: string;
  tenantId?: string;
  createdAt: Date;
  id: string;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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

export function encodeTaskCursor(cursor: TaskListCursor): string {
  const containerId = cursor.containerId?.trim() ?? "";
  const tenantId = cursor.tenantId?.trim() ?? "";
  if ((containerId && tenantId) || (!containerId && !tenantId)) {
    throw new Error("VALIDATION_FORMAT: cursor 范围无效");
  }
  return Buffer.from(
    JSON.stringify({
      ...(containerId ? { containerId } : { tenantId }),
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeTaskCursor(raw: string): TaskListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      containerId?: unknown;
      tenantId?: unknown;
      createdAt?: unknown;
      id?: unknown;
    };
    const containerId = hasText(parsed.containerId)
      ? parsed.containerId
      : undefined;
    const tenantId = hasText(parsed.tenantId) ? parsed.tenantId : undefined;
    if (
      (containerId && tenantId) ||
      (!containerId && !tenantId) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return containerId
      ? { containerId, createdAt, id: parsed.id }
      : { tenantId, createdAt, id: parsed.id };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
