import { createHash } from "node:crypto";

export const LIFECYCLE_DATE_FACT_INBOX_KIND =
  "lifecycle_date_fact.record_requested.v1";
export const LIFECYCLE_INBOX_CONSUMER_NAME = "lifecycle-control-inbox";

export function canonicalizeLifecycleDateFactInboxPayload(payload) {
  return JSON.stringify(sortJson(payload));
}

export function hashLifecycleDateFactInboxPayload(payload) {
  return createHash("sha256")
    .update(canonicalizeLifecycleDateFactInboxPayload(payload), "utf8")
    .digest("hex");
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
