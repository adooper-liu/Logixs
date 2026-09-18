export type ObjectActivityCode =
  | "lifecycle_event_recorded"
  | "problem_notification_posted"
  | "task_created"
  | "work_order_claimed"
  | "work_order_completed";

export interface ObjectActivityItem {
  id: string;
  activityCode: ObjectActivityCode;
  sourceType:
    "canonical_event" | "ops_notification" | "node_task" | "client_operation";
  sourceId: string;
  occurredAt: Date | null;
  recordedAt: Date;
  containerId: string;
  taskId: string | null;
  workOrderId: string | null;
  actorId: string | null;
  nodeCode: string | null;
  title: string | null;
  detail: string | null;
  severity: string | null;
  targetPath: string | null;
}

export interface ObjectActivityCursor {
  tenantId: string;
  containerId: string;
  asOf: Date;
  offset: number;
}

interface SerializedCursor {
  tenantId: string;
  containerId: string;
  asOf: string;
  offset: number;
}

export function parseObjectActivityPageSize(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 20;
  if (!/^\d+$/.test(raw)) {
    throw new Error("VALIDATION_FORMAT: pageSize 必须是整数");
  }
  const value = Number(raw);
  if (value < 1 || value > 100) {
    throw new Error("VALIDATION_RANGE: pageSize 必须在 1 到 100 之间");
  }
  return value;
}

export function encodeObjectActivityCursor(
  cursor: ObjectActivityCursor,
): string {
  const serialized: SerializedCursor = {
    tenantId: cursor.tenantId,
    containerId: cursor.containerId,
    asOf: cursor.asOf.toISOString(),
    offset: cursor.offset,
  };
  return Buffer.from(JSON.stringify(serialized), "utf8").toString("base64url");
}

export function decodeObjectActivityCursor(raw: string): ObjectActivityCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<SerializedCursor>;
    const tenantId = decoded.tenantId?.trim() ?? "";
    const containerId = decoded.containerId?.trim() ?? "";
    const asOf = new Date(decoded.asOf ?? "");
    const offset = decoded.offset;
    if (
      !tenantId ||
      !containerId ||
      Number.isNaN(asOf.getTime()) ||
      !Number.isSafeInteger(offset) ||
      (offset ?? -1) < 0 ||
      (offset ?? 10_001) > 10_000
    ) {
      throw new Error("invalid cursor");
    }
    return { tenantId, containerId, asOf, offset: offset as number };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor 无效");
  }
}

export function mergeObjectActivities(
  items: readonly ObjectActivityItem[],
): ObjectActivityItem[] {
  return [...items].sort((left, right) => {
    const leftTime = (left.occurredAt ?? left.recordedAt).getTime();
    const rightTime = (right.occurredAt ?? right.recordedAt).getTime();
    return rightTime - leftTime || right.id.localeCompare(left.id);
  });
}
