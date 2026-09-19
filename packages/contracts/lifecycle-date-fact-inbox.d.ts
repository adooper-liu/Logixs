import type {
  LifecycleDateFactCommand,
  LifecycleDateFactInboxPayload,
} from "./index";

export const LIFECYCLE_DATE_FACT_INBOX_KIND: "lifecycle_date_fact.record_requested.v1";
export const LIFECYCLE_INBOX_CONSUMER_NAME: "lifecycle-control-inbox";

export function canonicalizeLifecycleDateFactInboxPayload(
  payload: LifecycleDateFactInboxPayload,
): string;

export function hashLifecycleDateFactInboxPayload(
  payload: LifecycleDateFactInboxPayload,
): string;

export type { LifecycleDateFactCommand, LifecycleDateFactInboxPayload };
