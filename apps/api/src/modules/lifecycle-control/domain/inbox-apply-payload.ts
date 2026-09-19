import type { CanonicalEventCode } from "@logix/contracts";
import type { LifecycleDateFactInboxPayload } from "@logix/contracts";
import {
  LIFECYCLE_DATE_FACT_INBOX_KIND,
  hashLifecycleDateFactInboxPayload,
} from "@logix/contracts/lifecycle-date-fact-inbox";
import { hashOutboxPayload } from "./outbox-message";
import { parseInboxPayloadHash } from "./inbox-message";

export interface InboxLifecycleEventApplyPayload {
  containerId: string;
  eventCode: CanonicalEventCode;
  occurredAt: Date;
  evidenceRefs: string[];
  idempotencyKey: string;
}

export type InboxApplyPayload =
  InboxLifecycleEventApplyPayload | LifecycleDateFactInboxPayload;

export function parseInboxMessagePayload(raw: unknown): InboxApplyPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("VALIDATION_FORMAT: payload 必须是对象");
  }
  const body = raw as Record<string, unknown>;
  if (body.kind === LIFECYCLE_DATE_FACT_INBOX_KIND) {
    if (!body.command || typeof body.command !== "object") {
      throw new Error("VALIDATION_FORMAT: 日期事实命令缺失");
    }
    return {
      kind: LIFECYCLE_DATE_FACT_INBOX_KIND,
      command: body.command as LifecycleDateFactInboxPayload["command"],
    };
  }
  return parseInboxApplyPayload(raw);
}

export function parseInboxApplyPayload(
  raw: unknown,
): InboxLifecycleEventApplyPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("VALIDATION_FORMAT: payload 必须是对象");
  }
  const body = raw as Record<string, unknown>;
  const containerId =
    typeof body.containerId === "string" ? body.containerId.trim() : "";
  const eventCode =
    typeof body.eventCode === "string" ? body.eventCode.trim() : "";
  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const occurredAtRaw =
    typeof body.occurredAt === "string" ? body.occurredAt : "";
  const occurredAt = new Date(occurredAtRaw);
  if (!containerId || !eventCode || !idempotencyKey) {
    throw new Error("VALIDATION_FORMAT: payload 缺字段");
  }
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("VALIDATION_FORMAT: occurredAt 无效");
  }
  if (!Array.isArray(body.evidenceRefs) || body.evidenceRefs.length === 0) {
    throw new Error("VALIDATION_FORMAT: evidenceRefs 无效");
  }
  const evidenceRefs = body.evidenceRefs.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error("VALIDATION_FORMAT: evidenceRefs 无效");
    }
    return item.trim();
  });
  return {
    containerId,
    eventCode: eventCode as CanonicalEventCode,
    occurredAt,
    evidenceRefs,
    idempotencyKey,
  };
}

export function hashInboxApplyPayload(payload: InboxApplyPayload): string {
  if ("kind" in payload) {
    return hashLifecycleDateFactInboxPayload(payload);
  }
  return hashOutboxPayload(
    JSON.stringify({
      containerId: payload.containerId,
      eventCode: payload.eventCode,
      evidenceRefs: payload.evidenceRefs,
      idempotencyKey: payload.idempotencyKey,
      occurredAt: payload.occurredAt.toISOString(),
    }),
  );
}

export function assertInboxPayloadHash(
  payload: InboxApplyPayload,
  rawHash: string,
): string {
  const expected = hashInboxApplyPayload(payload);
  const incoming = parseInboxPayloadHash(rawHash);
  if (expected !== incoming) {
    throw new Error("VALIDATION_FORMAT: payloadHash 与载荷不一致");
  }
  return incoming;
}
