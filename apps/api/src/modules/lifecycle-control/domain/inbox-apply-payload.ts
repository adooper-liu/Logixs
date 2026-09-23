import type {
  CanonicalEventCode,
  StartPostDepartureLifecycleCommandV2,
} from "@logix/contracts";
import type { LifecycleDateFactInboxPayload } from "@logix/contracts";
import {
  LIFECYCLE_DATE_FACT_INBOX_KIND,
  hashLifecycleDateFactInboxPayload,
} from "@logix/contracts/lifecycle-date-fact-inbox";
import {
  hashPostDepartureLifecycleCommand,
  POST_DEPARTURE_FLOW_DEFINITION_CODE,
  POST_DEPARTURE_FLOW_DEFINITION_VERSION,
} from "@logix/contracts/post-departure-lifecycle";
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

export interface PostDepartureLifecycleInboxPayload {
  kind: "start_post_departure_lifecycle_v2";
  command: StartPostDepartureLifecycleCommandV2;
}

export type ParsedInboxPayload =
  InboxApplyPayload | PostDepartureLifecycleInboxPayload;

export function parseInboxMessagePayload(raw: unknown): ParsedInboxPayload {
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
  if (body.flowDefinitionCode === POST_DEPARTURE_FLOW_DEFINITION_CODE) {
    return {
      kind: "start_post_departure_lifecycle_v2",
      command: parsePostDepartureLifecycleCommand(body),
    };
  }
  return parseInboxApplyPayload(raw);
}

export function parsePostDepartureLifecycleCommand(
  raw: unknown,
): StartPostDepartureLifecycleCommandV2 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("VALIDATION_FORMAT: post-departure 命令必须是对象");
  }
  const body = raw as Record<string, unknown>;
  const expectedKeys = new Set([
    "shipmentId",
    "containerIds",
    "flowDefinitionCode",
    "definitionVersion",
    "departureEventId",
    "relationshipVersion",
    "idempotencyKey",
    "traceId",
  ]);
  if (Object.keys(body).some((key) => !expectedKeys.has(key))) {
    throw new Error("VALIDATION_FORMAT: post-departure 命令含未知字段");
  }
  const shipmentId = parseUuid(body.shipmentId, "shipmentId");
  const departureEventId = parseUuid(body.departureEventId, "departureEventId");
  if (
    body.flowDefinitionCode !== POST_DEPARTURE_FLOW_DEFINITION_CODE ||
    body.definitionVersion !== POST_DEPARTURE_FLOW_DEFINITION_VERSION
  ) {
    throw new Error("VALIDATION_FORMAT: post-departure 流程定义不受支持");
  }
  if (
    !Array.isArray(body.containerIds) ||
    body.containerIds.length === 0 ||
    body.containerIds.some(
      (value) =>
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.trim().length > 100,
    )
  ) {
    throw new Error("VALIDATION_FORMAT: containerIds 无效");
  }
  const containerIds = body.containerIds.map((value) =>
    (value as string).trim(),
  );
  if (new Set(containerIds).size !== containerIds.length) {
    throw new Error("VALIDATION_FORMAT: containerIds 不得重复");
  }
  if (
    !Number.isInteger(body.relationshipVersion) ||
    (body.relationshipVersion as number) < 1
  ) {
    throw new Error("VALIDATION_FORMAT: relationshipVersion 无效");
  }
  const idempotencyKey = parseBoundedText(
    body.idempotencyKey,
    "idempotencyKey",
    200,
  );
  const traceId = parseBoundedText(body.traceId, "traceId", 128);
  return {
    shipmentId,
    containerIds:
      containerIds as StartPostDepartureLifecycleCommandV2["containerIds"],
    flowDefinitionCode: POST_DEPARTURE_FLOW_DEFINITION_CODE,
    definitionVersion: POST_DEPARTURE_FLOW_DEFINITION_VERSION,
    departureEventId,
    relationshipVersion: body.relationshipVersion as number,
    idempotencyKey,
    traceId,
  };
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

export function hashInboxApplyPayload(payload: ParsedInboxPayload): string {
  if ("kind" in payload) {
    if (payload.kind === "start_post_departure_lifecycle_v2") {
      return hashPostDepartureLifecycleCommand(payload.command);
    }
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
  payload: ParsedInboxPayload,
  rawHash: string,
): string {
  const expected = hashInboxApplyPayload(payload);
  const incoming = parseInboxPayloadHash(rawHash);
  if (expected !== incoming) {
    throw new Error("VALIDATION_FORMAT: payloadHash 与载荷不一致");
  }
  return incoming;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new Error(`VALIDATION_FORMAT: ${field} 必须是 UUID`);
  }
  return value.trim();
}

function parseBoundedText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new Error(`VALIDATION_FORMAT: ${field} 无效`);
  }
  return value.trim();
}
