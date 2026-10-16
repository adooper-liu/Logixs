export const DEFAULT_PAGE_SIZE = 50;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 200;

export type ContainerListScope = "all" | "active_stuffing_snapshot";

export interface ContainerListCursor {
  tenantId: string;
  updatedAt: Date;
  id: string;
  scope?: ContainerListScope;
}

export function parseContainerListScope(
  raw: string | undefined,
): ContainerListScope {
  if (raw === undefined || raw === "" || raw === "all") return "all";
  if (raw === "active_stuffing_snapshot") return raw;
  throw new Error("VALIDATION_FORMAT: scope 无效");
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

export function encodeContainerCursor(cursor: ContainerListCursor): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      updatedAt: cursor.updatedAt.toISOString(),
      id: cursor.id,
      scope: cursor.scope ?? "all",
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeContainerCursor(raw: string): ContainerListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      updatedAt?: unknown;
      id?: unknown;
      scope?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.tenantId.length === 0 ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      (parsed.scope !== undefined &&
        parsed.scope !== "all" &&
        parsed.scope !== "active_stuffing_snapshot")
    ) {
      throw new Error("invalid");
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) throw new Error("invalid");
    return {
      tenantId: parsed.tenantId,
      updatedAt,
      id: parsed.id,
      scope: parsed.scope ?? "all",
    };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
