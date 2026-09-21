import { createHash } from "node:crypto";

export type CustomsFilingState = "not_filed" | "filed" | "accepted";
export type CustomsDecisionState = "pending" | "held" | "released";
export type CustomsCaseIngestionChannel =
  "api" | "webhook" | "file_import" | "manual_ui";

export interface ReplaceCustomsClearanceCaseCommand {
  tenantId: string;
  containerRecordId: string;
  expectedVersion: number;
  jurisdictionCountryCode: string;
  customsBrokerPartyId: string | null;
  declarationNumber: string | null;
  filingState: CustomsFilingState;
  decisionState: CustomsDecisionState;
  activeHoldCodes: string[];
  ingestionChannel: CustomsCaseIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedCustomsClearanceCaseCommand extends ReplaceCustomsClearanceCaseCommand {
  payloadHash: string;
}

export interface CustomsClearanceCaseRecord {
  caseId: string;
  containerRecordId: string;
  version: number;
  jurisdictionCountryCode: string;
  customsBrokerPartyId: string | null;
  declarationNumber: string | null;
  filingState: CustomsFilingState;
  decisionState: CustomsDecisionState;
  activeHoldCodes: string[];
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export class CustomsClearanceCaseValidationError extends Error {}
export class CustomsClearanceCaseConflictError extends Error {}

export function normalizeCustomsClearanceCaseCommand(
  input: ReplaceCustomsClearanceCaseCommand,
): NormalizedCustomsClearanceCaseCommand {
  const tenantId = text(input.tenantId, "tenantId", 128);
  const containerRecordId = uuid(input.containerRecordId, "containerRecordId");
  const expectedVersion = version(input.expectedVersion);
  const jurisdictionCountryCode = countryCode(input.jurisdictionCountryCode);
  const customsBrokerPartyId = optionalUuid(
    input.customsBrokerPartyId,
    "customsBrokerPartyId",
  );
  const declarationNumber = optionalText(
    input.declarationNumber,
    "declarationNumber",
    100,
  );
  if (!FILING_STATES.has(input.filingState)) fail("filingState");
  if (!DECISION_STATES.has(input.decisionState)) fail("decisionState");
  if (!INGESTION_CHANNELS.has(input.ingestionChannel)) {
    fail("ingestionChannel");
  }
  const sourceSystem = text(input.sourceSystem, "sourceSystem", 128);
  const actorId = text(input.actorId, "actorId", 128);
  const reasonCode = stableCode(input.reasonCode, "reasonCode");
  const idempotencyKey = text(input.idempotencyKey, "idempotencyKey", 200);
  const activeHoldCodes = uniqueCodes(input.activeHoldCodes, "activeHoldCodes");
  const evidenceRefs = uniqueUuids(input.evidenceRefs, "evidenceRefs");

  if (input.filingState !== "not_filed") {
    if (!declarationNumber) {
      throw new CustomsClearanceCaseValidationError(
        "CUSTOMS_DECLARATION_NUMBER_REQUIRED",
      );
    }
    if (!customsBrokerPartyId) {
      throw new CustomsClearanceCaseValidationError("CUSTOMS_BROKER_REQUIRED");
    }
  }
  if (input.decisionState === "held" && activeHoldCodes.length === 0) {
    throw new CustomsClearanceCaseValidationError("CUSTOMS_HOLD_CODE_REQUIRED");
  }
  if (input.decisionState !== "held" && activeHoldCodes.length > 0) {
    throw new CustomsClearanceCaseValidationError(
      "CUSTOMS_ACTIVE_HOLD_CONFLICT",
    );
  }
  if (input.decisionState === "released") {
    if (input.filingState !== "accepted") {
      throw new CustomsClearanceCaseValidationError(
        "CUSTOMS_FILING_NOT_ACCEPTED",
      );
    }
    if (evidenceRefs.length === 0) {
      throw new CustomsClearanceCaseValidationError("EVIDENCE_REQUIRED");
    }
  }

  const canonical = {
    contractVersion: "customs-clearance-case-v1",
    tenantId,
    containerRecordId,
    expectedVersion,
    jurisdictionCountryCode,
    customsBrokerPartyId,
    declarationNumber,
    filingState: input.filingState,
    decisionState: input.decisionState,
    activeHoldCodes,
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

function uniqueCodes(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(field);
  const normalized = value.map((item) => stableCode(item, field));
  if (new Set(normalized).size !== normalized.length) fail(field);
  return [...normalized].sort();
}

function uniqueUuids(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(field);
  const normalized = value.map((item) => uuid(item, field));
  if (new Set(normalized).size !== normalized.length) fail(field);
  return [...normalized].sort();
}

function optionalUuid(value: string | null, field: string): string | null {
  return value === null || value === "" ? null : uuid(value, field);
}

function optionalText(
  value: string | null,
  field: string,
  maximum: number,
): string | null {
  return value === null || value === "" ? null : text(value, field, maximum);
}

function countryCode(value: string): string {
  const normalized = text(value, "jurisdictionCountryCode", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) fail("jurisdictionCountryCode");
  return normalized;
}

function stableCode(value: unknown, field: string): string {
  if (typeof value !== "string") fail(field);
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(normalized)) fail(field);
  return normalized;
}

function text(value: unknown, field: string, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    Array.from(value).some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point <= 31 || point === 127);
    })
  ) {
    fail(field);
  }
  return value;
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) fail(field);
  return value.toLowerCase();
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) fail("expectedVersion");
  return value;
}

function fail(field: string): never {
  throw new CustomsClearanceCaseValidationError(`VALIDATION_FORMAT: ${field}`);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILING_STATES = new Set<CustomsFilingState>([
  "not_filed",
  "filed",
  "accepted",
]);
const DECISION_STATES = new Set<CustomsDecisionState>([
  "pending",
  "held",
  "released",
]);
const INGESTION_CHANNELS = new Set<CustomsCaseIngestionChannel>([
  "api",
  "webhook",
  "file_import",
  "manual_ui",
]);
