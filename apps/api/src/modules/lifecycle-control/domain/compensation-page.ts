export interface CompensationListCursor {
  tenantId: string;
  originalClientOperationId: string;
  createdAt: Date;
  id: string;
}

export function encodeCompensationCursor(
  cursor: CompensationListCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      originalClientOperationId: cursor.originalClientOperationId,
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeCompensationCursor(raw: string): CompensationListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      originalClientOperationId?: unknown;
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.tenantId.length === 0 ||
      typeof parsed.originalClientOperationId !== "string" ||
      parsed.originalClientOperationId.length === 0 ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return {
      tenantId: parsed.tenantId,
      originalClientOperationId: parsed.originalClientOperationId,
      createdAt,
      id: parsed.id,
    };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
