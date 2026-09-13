export interface LifecycleEventListCursor {
  tenantId: string;
  containerId: string;
  occurredAt: Date;
  id: string;
}

export function encodeLifecycleEventCursor(
  cursor: LifecycleEventListCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      containerId: cursor.containerId,
      occurredAt: cursor.occurredAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeLifecycleEventCursor(
  raw: string,
): LifecycleEventListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      containerId?: unknown;
      occurredAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.tenantId.length === 0 ||
      typeof parsed.containerId !== "string" ||
      parsed.containerId.length === 0 ||
      typeof parsed.occurredAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error("invalid");
    return {
      tenantId: parsed.tenantId,
      containerId: parsed.containerId,
      occurredAt,
      id: parsed.id,
    };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
