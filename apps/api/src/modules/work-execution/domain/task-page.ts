export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 200;

export interface TaskListCursor {
  containerId: string;
  createdAt: Date;
  id: string;
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
  return Buffer.from(
    JSON.stringify({
      containerId: cursor.containerId,
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
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.containerId !== "string" ||
      parsed.containerId.length === 0 ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return { containerId: parsed.containerId, createdAt, id: parsed.id };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
