export interface ClientOperationListCursor {
  tenantId: string;
  createdAt: Date;
  id: string;
}

export function encodeClientOperationCursor(
  cursor: ClientOperationListCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeClientOperationCursor(
  raw: string,
): ClientOperationListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.tenantId.length === 0 ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return { tenantId: parsed.tenantId, createdAt, id: parsed.id };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
