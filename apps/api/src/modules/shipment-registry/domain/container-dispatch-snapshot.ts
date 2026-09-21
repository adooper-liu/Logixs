import { createHash } from "node:crypto";

export type DispatchIngestionChannel =
  "api" | "webhook" | "file_import" | "manual_ui";
export type VgmHandoffState = "accepted";

export interface ReplaceContainerDispatchSnapshotCommand {
  tenantId: string;
  containerRecordId: string;
  expectedVersion: number;
  stuffingSnapshotId: string;
  stuffingSnapshotVersion: number;
  bookingNumber: string;
  carrierCode: string;
  vesselName: string;
  voyageNumber: string;
  masterBillNumber: string | null;
  houseBillNumber: string | null;
  vgmHandoffState: VgmHandoffState;
  ingestionChannel: DispatchIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedContainerDispatchSnapshotCommand extends ReplaceContainerDispatchSnapshotCommand {
  payloadHash: string;
}

export interface ContainerDispatchSnapshotRecord {
  snapshotId: string;
  containerRecordId: string;
  version: number;
  stuffingSnapshotId: string;
  stuffingSnapshotVersion: number;
  bookingNumber: string;
  carrierCode: string;
  vesselName: string;
  voyageNumber: string;
  masterBillNumber: string | null;
  houseBillNumber: string | null;
  vgmHandoffState: VgmHandoffState;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export class ContainerDispatchSnapshotValidationError extends Error {}
export class ContainerDispatchSnapshotConflictError extends Error {}
export class ContainerDispatchSnapshotNotFoundError extends Error {}

export function normalizeContainerDispatchSnapshotCommand(
  input: ReplaceContainerDispatchSnapshotCommand,
): NormalizedContainerDispatchSnapshotCommand {
  const tenantId = text(input.tenantId, "tenantId", 128);
  const containerRecordId = uuid(input.containerRecordId, "containerRecordId");
  const expectedVersion = version(
    input.expectedVersion,
    "expectedVersion",
    true,
  );
  const stuffingSnapshotId = uuid(
    input.stuffingSnapshotId,
    "stuffingSnapshotId",
  );
  const stuffingSnapshotVersion = version(
    input.stuffingSnapshotVersion,
    "stuffingSnapshotVersion",
    false,
  );
  const bookingNumber = text(input.bookingNumber, "bookingNumber", 100);
  const carrierCode = text(input.carrierCode, "carrierCode", 32).toUpperCase();
  const vesselName = text(input.vesselName, "vesselName", 128);
  const voyageNumber = text(input.voyageNumber, "voyageNumber", 64);
  const masterBillNumber = optionalText(
    input.masterBillNumber,
    "masterBillNumber",
    100,
  );
  const houseBillNumber = optionalText(
    input.houseBillNumber,
    "houseBillNumber",
    100,
  );
  if (input.vgmHandoffState !== "accepted") fail("vgmHandoffState");
  if (!INGESTION_CHANNELS.has(input.ingestionChannel)) {
    fail("ingestionChannel");
  }
  const sourceSystem = text(input.sourceSystem, "sourceSystem", 128);
  const actorId = text(input.actorId, "actorId", 128);
  const reasonCode = text(input.reasonCode, "reasonCode", 100);
  const idempotencyKey = text(input.idempotencyKey, "idempotencyKey", 200);
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
    fail("evidenceRefs");
  }
  const evidenceRefs = [
    ...new Set(input.evidenceRefs.map((value) => uuid(value, "evidenceRefs"))),
  ].sort();
  if (evidenceRefs.length !== input.evidenceRefs.length) fail("evidenceRefs");

  const canonical = {
    contractVersion: "container-dispatch-snapshot-v1",
    tenantId,
    containerRecordId,
    expectedVersion,
    stuffingSnapshotId,
    stuffingSnapshotVersion,
    bookingNumber,
    carrierCode,
    vesselName,
    voyageNumber,
    masterBillNumber,
    houseBillNumber,
    vgmHandoffState: input.vgmHandoffState,
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

function optionalText(
  value: string | null,
  field: string,
  maxLength: number,
): string | null {
  return value === null ? null : text(value, field, maxLength);
}

function text(value: string, field: string, maxLength: number): string {
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

function uuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function version(value: number, field: string, allowZero: boolean): number {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    fail(field);
  }
  return value;
}

function fail(field: string): never {
  throw new ContainerDispatchSnapshotValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INGESTION_CHANNELS = new Set<DispatchIngestionChannel>([
  "api",
  "webhook",
  "file_import",
  "manual_ui",
]);
