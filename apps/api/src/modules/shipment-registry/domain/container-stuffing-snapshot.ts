import { createHash } from "node:crypto";

export type StuffingIngestionChannel =
  "api" | "webhook" | "file_import" | "manual_ui";
export type VgmMethod = "method_1" | "method_2";

export interface StuffingVgmInput {
  weight: string;
  weightUnit: "KGM";
  method: VgmMethod;
  verifiedAt: string;
}

export interface ReplaceContainerStuffingSnapshotCommand {
  tenantId: string;
  containerRecordId: string;
  expectedVersion: number;
  allocationSetId: string;
  allocationSetVersion: number;
  containerNumber: string;
  sealNumber: string;
  packageCount: number;
  grossWeight: string;
  grossWeightUnit: "KGM";
  netWeight: string | null;
  volume: string;
  volumeUnit: "MTQ";
  vgm: StuffingVgmInput | null;
  ingestionChannel: StuffingIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedContainerStuffingSnapshotCommand extends ReplaceContainerStuffingSnapshotCommand {
  payloadHash: string;
}

export interface ContainerStuffingSnapshotRecord {
  snapshotId: string;
  containerRecordId: string;
  version: number;
  allocationSetId: string;
  allocationSetVersion: number;
  containerNumber: string;
  sealNumber: string;
  packageCount: number;
  grossWeight: string;
  grossWeightUnit: "KGM";
  netWeight: string | null;
  volume: string;
  volumeUnit: "MTQ";
  vgm: {
    weight: string;
    weightUnit: "KGM";
    method: VgmMethod;
    verifiedAt: string;
  } | null;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export class ContainerStuffingSnapshotValidationError extends Error {}
export class ContainerStuffingSnapshotConflictError extends Error {}
export class ContainerStuffingSnapshotNotFoundError extends Error {}

export function normalizeContainerStuffingSnapshotCommand(
  input: ReplaceContainerStuffingSnapshotCommand,
): NormalizedContainerStuffingSnapshotCommand {
  const tenantId = validatedText(input.tenantId, "tenantId", 128);
  const containerRecordId = validatedUuid(
    input.containerRecordId,
    "containerRecordId",
  );
  const expectedVersion = validatedVersion(
    input.expectedVersion,
    "expectedVersion",
    true,
  );
  const allocationSetId = validatedUuid(
    input.allocationSetId,
    "allocationSetId",
  );
  const allocationSetVersion = validatedVersion(
    input.allocationSetVersion,
    "allocationSetVersion",
    false,
  );
  const containerNumber = normalizeIso6346ContainerNumber(
    input.containerNumber,
  );
  const sealNumber = validatedText(input.sealNumber, "sealNumber", 64);
  if (
    !Number.isSafeInteger(input.packageCount) ||
    input.packageCount <= 0 ||
    input.packageCount > 10_000_000
  ) {
    fail("packageCount");
  }
  if (input.grossWeightUnit !== "KGM") fail("grossWeightUnit");
  if (input.volumeUnit !== "MTQ") fail("volumeUnit");
  const grossWeight = normalizedPositiveDecimal(
    input.grossWeight,
    "grossWeight",
  );
  const netWeight =
    input.netWeight === null
      ? null
      : normalizedPositiveDecimal(input.netWeight, "netWeight");
  const volume = normalizedPositiveDecimal(input.volume, "volume");
  if (
    netWeight !== null &&
    decimalToScaledInteger(netWeight) > decimalToScaledInteger(grossWeight)
  ) {
    fail("netWeight");
  }
  const vgm = normalizeVgm(input.vgm, grossWeight);
  if (!INGESTION_CHANNELS.has(input.ingestionChannel)) {
    fail("ingestionChannel");
  }
  const sourceSystem = validatedText(input.sourceSystem, "sourceSystem", 128);
  const actorId = validatedText(input.actorId, "actorId", 128);
  const reasonCode = validatedText(input.reasonCode, "reasonCode", 100);
  const idempotencyKey = validatedText(
    input.idempotencyKey,
    "idempotencyKey",
    200,
  );
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
    fail("evidenceRefs");
  }
  const evidenceRefs = [
    ...new Set(
      input.evidenceRefs.map((value) => validatedUuid(value, "evidenceRefs")),
    ),
  ].sort();
  if (evidenceRefs.length !== input.evidenceRefs.length) {
    fail("evidenceRefs");
  }

  const canonical = {
    contractVersion: "container-stuffing-snapshot-v1",
    tenantId,
    containerRecordId,
    expectedVersion,
    allocationSetId,
    allocationSetVersion,
    containerNumber,
    sealNumber,
    packageCount: input.packageCount,
    grossWeight,
    grossWeightUnit: input.grossWeightUnit,
    netWeight,
    volume,
    volumeUnit: input.volumeUnit,
    vgm,
    ingestionChannel: input.ingestionChannel,
    sourceSystem,
    evidenceRefs,
    actorId,
    reasonCode,
  };
  return {
    ...canonical,
    idempotencyKey,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(canonical), "utf8")
      .digest("hex"),
  };
}

export function decimalToScaledInteger(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

function normalizeVgm(
  input: StuffingVgmInput | null,
  grossWeight: string,
): NormalizedContainerStuffingSnapshotCommand["vgm"] {
  if (input === null) return null;
  if (input.weightUnit !== "KGM") fail("vgm.weightUnit");
  if (input.method !== "method_1" && input.method !== "method_2") {
    fail("vgm.method");
  }
  const weight = normalizedPositiveDecimal(input.weight, "vgm.weight");
  if (decimalToScaledInteger(weight) < decimalToScaledInteger(grossWeight)) {
    fail("vgm.weight");
  }
  const verifiedAt = normalizedOffsetDateTime(
    input.verifiedAt,
    "vgm.verifiedAt",
  );
  return {
    weight,
    weightUnit: input.weightUnit,
    method: input.method,
    verifiedAt,
  };
}

function normalizeIso6346ContainerNumber(value: string): string {
  if (typeof value !== "string" || value !== value.trim()) {
    fail("containerNumber");
  }
  const normalized = value.toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(normalized)) fail("containerNumber");
  const expectedCheckDigit = Number(normalized.at(-1));
  const body = normalized.slice(0, 10);
  let sum = 0;
  for (const [index, character] of [...body].entries()) {
    const valueForCharacter = /\d/.test(character)
      ? Number(character)
      : iso6346LetterValue(character);
    sum += valueForCharacter * 2 ** index;
  }
  const remainder = sum % 11;
  const calculated = remainder === 10 ? 0 : remainder;
  if (calculated !== expectedCheckDigit) fail("containerNumber");
  return normalized;
}

function iso6346LetterValue(character: string): number {
  const code = character.charCodeAt(0) - 65;
  return 10 + code + Math.floor((code + 10) / 11);
}

function normalizedPositiveDecimal(value: string, field: string): string {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) fail(field);
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalized = normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
  if (decimalToScaledInteger(normalized) <= 0n) fail(field);
  return normalized;
}

function normalizedOffsetDateTime(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    fail(field);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(field);
  return parsed.toISOString();
}

function validatedVersion(
  value: number,
  field: string,
  allowZero: boolean,
): number {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    fail(field);
  }
  return value;
}

function validatedText(
  value: string,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim() ||
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
  ) {
    fail(field);
  }
  return value;
}

function validatedUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function fail(field: string): never {
  throw new ContainerStuffingSnapshotValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
const INGESTION_CHANNELS = new Set<StuffingIngestionChannel>([
  "api",
  "webhook",
  "file_import",
  "manual_ui",
]);
