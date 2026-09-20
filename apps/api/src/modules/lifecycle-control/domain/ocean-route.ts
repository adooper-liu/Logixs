import { createHash } from "node:crypto";
import type {
  OceanRouteSegmentInput,
  OceanRouteWriteCommand,
} from "@logix/contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNLOCODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;
const TRANSPORT_MODES = ["vessel", "feeder", "barge"] as const;
const INGESTION_CHANNELS = ["api", "file_import", "manual_ui"] as const;

export interface NormalizedOceanRouteWriteCommand extends Omit<
  OceanRouteWriteCommand,
  "segments" | "evidenceRefs"
> {
  segments: OceanRouteSegmentInput[];
  evidenceRefs: string[];
}

export interface OceanRouteWriteCommandInput extends Omit<
  OceanRouteWriteCommand,
  "segments" | "evidenceRefs"
> {
  segments: OceanRouteSegmentInput[];
  evidenceRefs: string[];
}

export class OceanRouteCommandError extends Error {}

export function normalizeOceanRouteCommand(
  input: OceanRouteWriteCommandInput,
): NormalizedOceanRouteWriteCommand {
  if (
    !UUID_PATTERN.test(input.tenantId) ||
    !UUID_PATTERN.test(input.containerId)
  ) {
    fail("VALIDATION_FORMAT: tenantId 或 containerId 无效");
  }
  if (!Array.isArray(input.segments) || input.segments.length < 1) {
    fail("VALIDATION_REQUIRED: 路线至少需要一个航段");
  }
  if (input.segments.length > 20) {
    fail("VALIDATION_RANGE: 路线航段不能超过 20 个");
  }
  if (!INGESTION_CHANNELS.includes(input.ingestionChannel)) {
    fail("VALIDATION_FORMAT: ingestionChannel 无效");
  }
  const sourceSystem = requiredString(input.sourceSystem, 64, "sourceSystem");
  const idempotencyKey = requiredString(
    input.idempotencyKey,
    200,
    "idempotencyKey",
  );
  const traceId = requiredString(input.traceId, 128, "traceId");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    fail("VALIDATION_FORMAT: expectedVersion 无效");
  }
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length < 1) {
    fail("EVIDENCE_REQUIRED: 权威路线缺少证据");
  }
  const evidenceRefs = [
    ...new Set(input.evidenceRefs.map((value) => value.trim())),
  ];
  if (evidenceRefs.some((value) => !UUID_PATTERN.test(value))) {
    fail("VALIDATION_FORMAT: evidenceRefs 无效");
  }
  const actorId = optionalString(input.actorId, 100, "actorId");
  const reasonCode = optionalString(input.reasonCode, 64, "reasonCode");
  if (actorId && !UUID_PATTERN.test(actorId)) {
    fail("VALIDATION_FORMAT: actorId 无效");
  }
  if (input.ingestionChannel === "manual_ui" && (!actorId || !reasonCode)) {
    fail("VALIDATION_REQUIRED: 人工路线更新缺少操作者或原因");
  }

  const segments = input.segments.map((segment, index) =>
    normalizeSegment(segment, index),
  );
  for (let index = 1; index < segments.length; index += 1) {
    if (
      segments[index - 1]?.destinationUnlocode !==
        segments[index]?.originUnlocode ||
      segments[index - 1]?.destinationTimezone !==
        segments[index]?.originTimezone
    ) {
      fail(
        `VALIDATION_FIELD_CONFLICT: 第 ${index + 1} 航段与前一航段的港口或时区不连续`,
      );
    }
  }

  return {
    tenantId: input.tenantId.toLowerCase(),
    containerId: input.containerId.toLowerCase(),
    segments,
    ingestionChannel: input.ingestionChannel,
    sourceSystem,
    evidenceRefs,
    actorId,
    reasonCode,
    expectedVersion: input.expectedVersion,
    idempotencyKey,
    traceId,
  };
}

export function hashOceanRouteCommand(
  input: NormalizedOceanRouteWriteCommand,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...input,
        evidenceRefs: [...input.evidenceRefs].sort(),
      }),
    )
    .digest("hex");
}

function normalizeSegment(
  segment: OceanRouteSegmentInput,
  index: number,
): OceanRouteSegmentInput {
  if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
    fail(`VALIDATION_FORMAT: 第 ${index + 1} 航段无效`);
  }
  if (!TRANSPORT_MODES.includes(segment.transportMode)) {
    fail(`VALIDATION_FORMAT: 第 ${index + 1} 航段运输方式无效`);
  }
  const originUnlocode = normalizeUnlocode(
    segment.originUnlocode,
    index,
    "originUnlocode",
  );
  const destinationUnlocode = normalizeUnlocode(
    segment.destinationUnlocode,
    index,
    "destinationUnlocode",
  );
  const originTimezone = normalizeTimezone(
    segment.originTimezone,
    index,
    "originTimezone",
  );
  const destinationTimezone = normalizeTimezone(
    segment.destinationTimezone,
    index,
    "destinationTimezone",
  );
  if (
    !(["port", "terminal"] as const).includes(segment.destinationLocationType)
  ) {
    fail(`VALIDATION_FORMAT: 第 ${index + 1} 航段目的地类型无效`);
  }
  const destinationLocationId = optionalString(
    segment.destinationLocationId,
    100,
    `segments[${index}].destinationLocationId`,
  );
  if (
    segment.destinationLocationType === "terminal" &&
    (!destinationLocationId || !UUID_PATTERN.test(destinationLocationId))
  ) {
    fail(`VALIDATION_REQUIRED: 第 ${index + 1} 航段码头缺少有效 locationId`);
  }
  if (destinationLocationId && !UUID_PATTERN.test(destinationLocationId)) {
    fail(`VALIDATION_FORMAT: 第 ${index + 1} 航段 locationId 无效`);
  }
  const destinationPortCallId = optionalString(
    segment.destinationPortCallId,
    200,
    `segments[${index}].destinationPortCallId`,
  );
  return {
    transportMode: segment.transportMode,
    originUnlocode,
    originTimezone,
    destinationLocationType: segment.destinationLocationType,
    destinationUnlocode,
    ...(destinationLocationId ? { destinationLocationId } : {}),
    ...(destinationPortCallId ? { destinationPortCallId } : {}),
    destinationTimezone,
  };
}

function normalizeUnlocode(
  value: unknown,
  index: number,
  field: string,
): string {
  const normalized = requiredString(
    value,
    5,
    `segments[${index}].${field}`,
  ).toUpperCase();
  if (!UNLOCODE_PATTERN.test(normalized)) {
    fail(`VALIDATION_FORMAT: 第 ${index + 1} 航段 ${field} 无效`);
  }
  return normalized;
}

function normalizeTimezone(
  value: unknown,
  index: number,
  field: string,
): string {
  const normalized = requiredString(value, 100, `segments[${index}].${field}`);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format();
  } catch {
    fail(`VALIDATION_FORMAT: 第 ${index + 1} 航段 ${field} 不是有效 IANA 时区`);
  }
  return normalized;
}

function requiredString(
  value: unknown,
  maximum: number,
  field: string,
): string {
  if (typeof value !== "string") fail(`VALIDATION_FORMAT: ${field} 无效`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    fail(`VALIDATION_FORMAT: ${field} 无效`);
  }
  return normalized;
}

function optionalString(
  value: unknown,
  maximum: number,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, maximum, field);
}

function fail(message: string): never {
  throw new OceanRouteCommandError(message);
}
