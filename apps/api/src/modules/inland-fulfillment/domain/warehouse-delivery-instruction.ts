import { createHash } from "node:crypto";

export type DeliveryInstructionIngestionChannel =
  "api" | "webhook" | "file_import" | "manual_ui";

export interface ReplaceWarehouseDeliveryInstructionCommand {
  tenantId: string;
  containerRecordId: string;
  expectedVersion: number;
  warehouseLocationId: string;
  warehouseCode: string | null;
  warehouseName: string;
  unlocode: string | null;
  timezone: string;
  appointmentStartAt: string | null;
  appointmentEndAt: string | null;
  appointmentReference: string | null;
  ingestionChannel: DeliveryInstructionIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedWarehouseDeliveryInstructionCommand extends Omit<
  ReplaceWarehouseDeliveryInstructionCommand,
  "appointmentStartAt" | "appointmentEndAt"
> {
  appointmentStartAt: Date | null;
  appointmentEndAt: Date | null;
  payloadHash: string;
}

export interface WarehouseDeliveryInstructionRecord {
  instructionId: string;
  containerRecordId: string;
  version: number;
  warehouseLocationId: string;
  warehouseCode: string | null;
  warehouseName: string;
  unlocode: string | null;
  timezone: string;
  appointmentStartAt: string | null;
  appointmentEndAt: string | null;
  appointmentReference: string | null;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export class WarehouseDeliveryInstructionValidationError extends Error {}
export class WarehouseDeliveryInstructionConflictError extends Error {}
export class WarehouseDeliveryInstructionNotFoundError extends Error {}

export function normalizeWarehouseDeliveryInstructionCommand(
  input: ReplaceWarehouseDeliveryInstructionCommand,
): NormalizedWarehouseDeliveryInstructionCommand {
  const tenantId = text(input.tenantId, "tenantId", 128);
  const containerRecordId = uuid(input.containerRecordId, "containerRecordId");
  const expectedVersion = version(input.expectedVersion, "expectedVersion");
  const warehouseLocationId = uuid(
    input.warehouseLocationId,
    "warehouseLocationId",
  );
  const warehouseCode = optionalText(input.warehouseCode, "warehouseCode", 64);
  const warehouseName = text(input.warehouseName, "warehouseName", 200);
  const unlocode = optionalUnlocode(input.unlocode);
  const timezone = ianaTimezone(input.timezone);
  const appointmentStartAt = optionalDate(
    input.appointmentStartAt,
    "appointmentStartAt",
  );
  const appointmentEndAt = optionalDate(
    input.appointmentEndAt,
    "appointmentEndAt",
  );
  if (Boolean(appointmentStartAt) !== Boolean(appointmentEndAt)) {
    fail("appointmentWindow");
  }
  if (
    appointmentStartAt &&
    appointmentEndAt &&
    appointmentEndAt.getTime() <= appointmentStartAt.getTime()
  ) {
    fail("appointmentWindow");
  }
  const appointmentReference = optionalText(
    input.appointmentReference,
    "appointmentReference",
    100,
  );
  if (!INGESTION_CHANNELS.has(input.ingestionChannel)) {
    fail("ingestionChannel");
  }
  const sourceSystem = text(input.sourceSystem, "sourceSystem", 128);
  const actorId = text(input.actorId, "actorId", 128);
  const reasonCode = stableCode(input.reasonCode, "reasonCode");
  const idempotencyKey = text(input.idempotencyKey, "idempotencyKey", 200);
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
    fail("evidenceRefs");
  }
  const evidenceRefs = [
    ...new Set(input.evidenceRefs.map((value) => uuid(value, "evidenceRefs"))),
  ].sort();
  if (evidenceRefs.length !== input.evidenceRefs.length) fail("evidenceRefs");

  const canonical = {
    contractVersion: "warehouse-delivery-instruction-v1",
    tenantId,
    containerRecordId,
    expectedVersion,
    warehouseLocationId,
    warehouseCode,
    warehouseName,
    unlocode,
    timezone,
    appointmentStartAt: appointmentStartAt?.toISOString() ?? null,
    appointmentEndAt: appointmentEndAt?.toISOString() ?? null,
    appointmentReference,
    ingestionChannel: input.ingestionChannel,
    sourceSystem,
    evidenceRefs,
    actorId,
    reasonCode,
  };
  return {
    ...canonical,
    appointmentStartAt,
    appointmentEndAt,
    idempotencyKey,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(canonical), "utf8")
      .digest("hex"),
  };
}

function text(value: string, field: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim() ||
    containsControlCharacter(value)
  ) {
    fail(field);
  }
  return value;
}

function optionalText(
  value: string | null,
  field: string,
  maxLength: number,
): string | null {
  return value === null ? null : text(value, field, maxLength);
}

function uuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) fail(field);
  return value;
}

function stableCode(value: string, field: string): string {
  if (typeof value !== "string" || !STABLE_CODE_PATTERN.test(value)) {
    fail(field);
  }
  return value;
}

function optionalUnlocode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.toUpperCase();
  if (!UNLOCODE_PATTERN.test(normalized)) fail("unlocode");
  return normalized;
}

function ianaTimezone(value: string): string {
  const normalized = text(value, "timezone", 100);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(0);
  } catch {
    fail("timezone");
  }
  if (!normalized.includes("/") && normalized !== "Etc/UTC") {
    fail("timezone");
  }
  return normalized;
}

function optionalDate(value: string | null, field: string): Date | null {
  if (value === null) return null;
  if (typeof value !== "string" || !TIME_WITH_OFFSET.test(value)) fail(field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(field);
  return parsed;
}

function fail(field: string): never {
  throw new WarehouseDeliveryInstructionValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STABLE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
const UNLOCODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;
const TIME_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;
const INGESTION_CHANNELS = new Set<DeliveryInstructionIngestionChannel>([
  "api",
  "webhook",
  "file_import",
  "manual_ui",
]);
