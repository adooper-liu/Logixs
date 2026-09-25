import type { ShipmentLifecycleStatusV1 } from "@logix/contracts";

export const DEFAULT_SHIPMENT_PAGE_SIZE = 50;
export const MAX_SHIPMENT_PAGE_SIZE = 200;
const SHIPMENT_READ_PERMISSION_SCOPE = "container.read+lifecycle.read";
export const SHIPMENT_PENDING_COMPLETION_CURSOR_SCOPE =
  "container.read+lifecycle.read+pending-completion";

export interface ShipmentListCursor {
  tenantId: string;
  status: ShipmentLifecycleStatusV1 | null;
  updatedAt: Date;
  id: string;
}

export function parseShipmentPageSize(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_SHIPMENT_PAGE_SIZE;
  if (!/^\d+$/.test(raw)) {
    throw new Error("VALIDATION_FORMAT: pageSize 必须是整数");
  }
  const pageSize = Number(raw);
  if (pageSize < 1 || pageSize > MAX_SHIPMENT_PAGE_SIZE) {
    throw new Error("VALIDATION_FORMAT: pageSize 超出 1-200");
  }
  return pageSize;
}

const SHIPMENT_STATUSES = new Set<ShipmentLifecycleStatusV1>([
  "departed",
  "in_transit",
  "arrived",
  "customs_clearance",
  "released",
  "picked_up",
  "delivered_to_warehouse",
  "closed",
]);

export function parseShipmentStatus(
  raw: string | undefined,
): ShipmentLifecycleStatusV1 | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (!SHIPMENT_STATUSES.has(raw as ShipmentLifecycleStatusV1)) {
    throw new Error("VALIDATION_FORMAT: status 无效");
  }
  return raw as ShipmentLifecycleStatusV1;
}

export function encodeShipmentCursor(
  cursor: ShipmentListCursor,
  cursorScope = SHIPMENT_READ_PERMISSION_SCOPE,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      permissionScope: cursorScope,
      status: cursor.status,
      updatedAt: cursor.updatedAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeShipmentCursor(
  raw: string,
  cursorScope = SHIPMENT_READ_PERMISSION_SCOPE,
): ShipmentListCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      permissionScope?: unknown;
      status?: unknown;
      updatedAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.tenantId.length === 0 ||
      parsed.permissionScope !== cursorScope ||
      !(
        parsed.status === null ||
        (typeof parsed.status === "string" &&
          SHIPMENT_STATUSES.has(parsed.status as ShipmentLifecycleStatusV1))
      ) ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("invalid");
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) throw new Error("invalid");
    return {
      tenantId: parsed.tenantId,
      status: parsed.status as ShipmentLifecycleStatusV1 | null,
      updatedAt,
      id: parsed.id,
    };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}
