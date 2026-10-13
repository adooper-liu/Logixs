import { createHash } from "node:crypto";
import type {
  ProductInitiativeBusinessCaseDimensionDraftV1,
  ProductInitiativeReviewPointV1,
  ProductInitiativeRiskAssessmentDraftV1,
  ProductInitiativeUnitEconomicsDraftV1,
  SaveProductInitiativeDecisionDraftCommandV1,
} from "@logix/contracts";

export interface CurrentProductInitiativeDraftState {
  draftVersion: number;
  initiativeVersion: number;
}

export interface PreparedProductInitiativeDecisionDraft {
  draftVersion: number;
  initiativeVersionSeen: number;
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPointV1[];
  businessCaseDraft: ProductInitiativeBusinessCaseDimensionDraftV1[];
  riskAssessmentDraft: ProductInitiativeRiskAssessmentDraftV1[];
  unitEconomicsDraft: ProductInitiativeUnitEconomicsDraftV1 | null;
  negativeConservativeReason: string | null;
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductInitiativeDraftValidationError extends Error {}
export class ProductInitiativeDraftConflictError extends Error {}

export function prepareProductInitiativeDecisionDraft(
  actorId: string,
  command: SaveProductInitiativeDecisionDraftCommandV1,
  current: CurrentProductInitiativeDraftState = {
    draftVersion: 0,
    initiativeVersion: command.initiativeVersionSeen,
  },
): PreparedProductInitiativeDecisionDraft {
  if (command.contractVersion !== "product-initiative-decision-draft-save.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedDraftVersion = version(
    command.expectedDraftVersion,
    "expectedDraftVersion",
  );
  const initiativeVersionSeen = version(
    command.initiativeVersionSeen,
    "initiativeVersionSeen",
  );
  if (expectedDraftVersion !== current.draftVersion) {
    conflict("PRODUCT_INITIATIVE_DRAFT_VERSION_CONFLICT");
  }
  if (initiativeVersionSeen !== current.initiativeVersion) {
    conflict("PRODUCT_INITIATIVE_DRAFT_BASE_VERSION_CONFLICT");
  }

  const normalized = {
    draftVersion: current.draftVersion + 1,
    initiativeVersionSeen,
    objective: optionalText(command.objective, "objective", 4000),
    reviewPoints: structuredClone(command.reviewPoints),
    businessCaseDraft: structuredClone(command.businessCaseDraft),
    riskAssessmentDraft: structuredClone(command.riskAssessmentDraft),
    unitEconomicsDraft: command.unitEconomicsDraft
      ? structuredClone(command.unitEconomicsDraft)
      : null,
    negativeConservativeReason: optionalText(
      command.negativeConservativeReason,
      "negativeConservativeReason",
      2000,
    ),
    idempotencyKey,
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid(field);
  return value;
}

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function optionalText(
  value: string | null,
  field: string,
  maxLength: number,
): string | null {
  if (value === null) return null;
  return text(value, field, maxLength);
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function invalid(field: string): never {
  throw new ProductInitiativeDraftValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

function conflict(code: string): never {
  throw new ProductInitiativeDraftConflictError(code);
}
