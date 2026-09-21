import { createHash } from "node:crypto";

export type UnloadingIngestionChannel =
  "api" | "webhook" | "file_import" | "manual_ui";
export type UnloadingOperationState = "started" | "partial" | "completed";
export type UnloadingQuantityUnit = "piece" | "carton" | "set" | "pallet";
export type UnloadingSealCheck = "matched" | "mismatch";

export interface AppendContainerUnloadingReportCommand {
  tenantId: string;
  containerRecordId: string;
  expectedVersion: number;
  warehouseLocationId: string;
  operationState: UnloadingOperationState;
  startedAt: string;
  completedAt: string | null;
  expectedQuantity: string;
  unloadedQuantity: string;
  remainingQuantity: string;
  damagedQuantity: string;
  shortageQuantity: string;
  quantityUnit: UnloadingQuantityUnit;
  sealCheck: UnloadingSealCheck;
  exceptionResolved: boolean;
  exceptionNotes: string | null;
  ingestionChannel: UnloadingIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedContainerUnloadingReportCommand extends Omit<
  AppendContainerUnloadingReportCommand,
  | "startedAt"
  | "completedAt"
  | "expectedQuantity"
  | "unloadedQuantity"
  | "remainingQuantity"
  | "damagedQuantity"
  | "shortageQuantity"
> {
  startedAt: Date;
  completedAt: Date | null;
  expectedQuantity: string;
  unloadedQuantity: string;
  remainingQuantity: string;
  damagedQuantity: string;
  shortageQuantity: string;
  payloadHash: string;
}

export interface ContainerUnloadingReportRecord {
  reportId: string;
  containerRecordId: string;
  version: number;
  warehouseLocationId: string;
  operationState: UnloadingOperationState;
  startedAt: string;
  completedAt: string | null;
  expectedQuantity: string;
  unloadedQuantity: string;
  remainingQuantity: string;
  damagedQuantity: string;
  shortageQuantity: string;
  quantityUnit: UnloadingQuantityUnit;
  sealCheck: UnloadingSealCheck;
  exceptionResolved: boolean;
  exceptionNotes: string | null;
  evidenceRefs: [string, ...string[]];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export class ContainerUnloadingReportValidationError extends Error {}
export class ContainerUnloadingReportConflictError extends Error {}
export class ContainerUnloadingReportNotFoundError extends Error {}

export function normalizeContainerUnloadingReportCommand(
  input: AppendContainerUnloadingReportCommand,
): NormalizedContainerUnloadingReportCommand {
  const tenantId = text(input.tenantId, "tenantId", 128);
  const containerRecordId = uuid(input.containerRecordId, "containerRecordId");
  const expectedVersion = version(input.expectedVersion);
  const warehouseLocationId = uuid(
    input.warehouseLocationId,
    "warehouseLocationId",
  );
  if (!OPERATION_STATES.has(input.operationState)) fail("operationState");
  const startedAt = date(input.startedAt, "startedAt");
  const completedAt =
    input.completedAt === null ? null : date(input.completedAt, "completedAt");
  const expectedQuantity = decimal(input.expectedQuantity, "expectedQuantity");
  const unloadedQuantity = decimal(input.unloadedQuantity, "unloadedQuantity");
  const remainingQuantity = decimal(
    input.remainingQuantity,
    "remainingQuantity",
  );
  const damagedQuantity = decimal(input.damagedQuantity, "damagedQuantity");
  const shortageQuantity = decimal(input.shortageQuantity, "shortageQuantity");
  const expected = scaled(expectedQuantity);
  const unloaded = scaled(unloadedQuantity);
  const remaining = scaled(remainingQuantity);
  const damaged = scaled(damagedQuantity);
  const shortage = scaled(shortageQuantity);
  if (expected <= 0n || unloaded + remaining + shortage !== expected) {
    fail("quantityBalance");
  }
  if (damaged > unloaded) fail("damagedQuantity");
  if (!QUANTITY_UNITS.has(input.quantityUnit)) fail("quantityUnit");
  if (!SEAL_CHECKS.has(input.sealCheck)) fail("sealCheck");
  if (typeof input.exceptionResolved !== "boolean") fail("exceptionResolved");
  const hasException =
    input.sealCheck === "mismatch" || damaged > 0n || shortage > 0n;
  const exceptionNotes = optionalText(
    input.exceptionNotes,
    "exceptionNotes",
    1000,
  );
  if (hasException && !exceptionNotes) fail("exceptionNotes");
  assertProgress({
    operationState: input.operationState,
    startedAt,
    completedAt,
    expected,
    unloaded,
    remaining,
    damaged,
    shortage,
    hasException,
    exceptionResolved: input.exceptionResolved,
  });
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
  ].sort() as [string, ...string[]];
  if (evidenceRefs.length !== input.evidenceRefs.length) fail("evidenceRefs");

  const canonical = {
    contractVersion: "container-unloading-report-v1",
    tenantId,
    containerRecordId,
    expectedVersion,
    warehouseLocationId,
    operationState: input.operationState,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt?.toISOString() ?? null,
    expectedQuantity,
    unloadedQuantity,
    remainingQuantity,
    damagedQuantity,
    shortageQuantity,
    quantityUnit: input.quantityUnit,
    sealCheck: input.sealCheck,
    exceptionResolved: input.exceptionResolved,
    exceptionNotes,
    ingestionChannel: input.ingestionChannel,
    sourceSystem,
    evidenceRefs,
    actorId,
    reasonCode,
  };
  return {
    ...canonical,
    startedAt,
    completedAt,
    idempotencyKey,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(canonical), "utf8")
      .digest("hex"),
  };
}

export function assertUnloadingStateProgression(
  current: UnloadingOperationState | null,
  next: UnloadingOperationState,
): void {
  if (!current) return;
  const order: Record<UnloadingOperationState, number> = {
    started: 0,
    partial: 1,
    completed: 2,
  };
  if (
    order[next] < order[current] ||
    (current === "completed" && next !== "completed")
  ) {
    throw new ContainerUnloadingReportConflictError(
      "CONTAINER_UNLOADING_STATE_REGRESSION",
    );
  }
}

function assertProgress(input: {
  operationState: UnloadingOperationState;
  startedAt: Date;
  completedAt: Date | null;
  expected: bigint;
  unloaded: bigint;
  remaining: bigint;
  damaged: bigint;
  shortage: bigint;
  hasException: boolean;
  exceptionResolved: boolean;
}): void {
  if (input.operationState === "started") {
    if (
      input.completedAt ||
      input.unloaded !== 0n ||
      input.remaining !== input.expected ||
      input.damaged !== 0n ||
      input.shortage !== 0n
    ) {
      fail("operationState");
    }
    return;
  }
  if (input.operationState === "partial") {
    if (input.completedAt || input.unloaded <= 0n || input.remaining <= 0n) {
      fail("operationState");
    }
    return;
  }
  if (
    !input.completedAt ||
    input.completedAt.getTime() < input.startedAt.getTime() ||
    input.remaining !== 0n ||
    (input.hasException && !input.exceptionResolved)
  ) {
    fail("operationState");
  }
}

function decimal(value: string, field: string): string {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) fail(field);
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
}

function scaled(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

function date(value: string, field: string): Date {
  if (typeof value !== "string" || !TIME_WITH_OFFSET.test(value)) fail(field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(field);
  return parsed;
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

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function optionalText(value: string | null, field: string, maxLength: number) {
  return value === null ? null : text(value, field, maxLength);
}

function uuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) fail("expectedVersion");
  return value;
}

function stableCode(value: string, field: string): string {
  if (typeof value !== "string" || !STABLE_CODE_PATTERN.test(value))
    fail(field);
  return value;
}

function fail(field: string): never {
  throw new ContainerUnloadingReportValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
const TIME_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/i;
const STABLE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,99}$/;
const OPERATION_STATES = new Set<UnloadingOperationState>([
  "started",
  "partial",
  "completed",
]);
const QUANTITY_UNITS = new Set<UnloadingQuantityUnit>([
  "piece",
  "carton",
  "set",
  "pallet",
]);
const SEAL_CHECKS = new Set<UnloadingSealCheck>(["matched", "mismatch"]);
const INGESTION_CHANNELS = new Set<UnloadingIngestionChannel>([
  "api",
  "webhook",
  "file_import",
  "manual_ui",
]);
