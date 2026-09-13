export const OUTBOX_PUBLISH_DUE_WORKFLOW = "outboxPublishDueWorkflow";
export const OUTBOX_PUBLISH_DUE_SYSTEM_WORKFLOW =
  "outboxPublishDueSystemWorkflow";
export const OUTBOX_PUBLISH_DUE_SYSTEM_SCHEDULE_ID =
  "outbox-publish-due-system";
export const BUSINESS_TASK_QUEUE = "logix-business";
export const DEFAULT_SCHEDULE_INTERVAL_SECONDS = 30;
export const MIN_SCHEDULE_INTERVAL_SECONDS = 5;
export const MAX_SCHEDULE_INTERVAL_SECONDS = 3600;

export interface OutboxPublishDueWorkflowArgs {
  tenantId: string;
  operatorId: string;
  limit?: number;
  maxRounds?: number;
}

export interface OutboxPublishDueSystemWorkflowArgs {
  limit?: number;
  maxRounds?: number;
  maxTenants?: number;
}

export function outboxPublishDueScheduleId(tenantId: string): string {
  const tenant = tenantId.trim();
  if (tenant.length === 0) {
    throw new Error("VALIDATION_FORMAT: tenantId 无效");
  }
  return `outbox-publish-due:${tenant}`;
}

export function outboxPublishDueSystemScheduleId(): string {
  return OUTBOX_PUBLISH_DUE_SYSTEM_SCHEDULE_ID;
}

export function parseScheduleIntervalSeconds(
  raw: number | string | undefined,
): number {
  if (raw === undefined || raw === "") return DEFAULT_SCHEDULE_INTERVAL_SECONDS;
  const text = typeof raw === "number" ? String(raw) : raw;
  if (!/^\d+$/.test(text)) {
    throw new Error("VALIDATION_FORMAT: intervalSeconds 必须是整数");
  }
  const seconds = Number(text);
  if (
    seconds < MIN_SCHEDULE_INTERVAL_SECONDS ||
    seconds > MAX_SCHEDULE_INTERVAL_SECONDS
  ) {
    throw new Error("VALIDATION_FORMAT: intervalSeconds 超出 5–3600");
  }
  return seconds;
}
