import { createHash } from "node:crypto";

export interface CargoScopeInput {
  allocationSetId: string;
  allocationSetVersion: number;
  items: Array<{
    replenishmentOrderLineId: string;
    productSkuId: string;
    productNumber: string;
  }>;
}

export interface ComplianceProfileInput {
  profileId: string;
  version: number;
  verificationState: string;
  battery: { presenceState: string };
  refrigerant: { presenceState: string };
  dangerousGoods: { classificationState: string };
  inspectionRequirements: Array<{ requirementState: string }>;
  certificates: Array<{
    certificateType: string;
    coverageScope: "global" | "countries";
    coveredCountryCodes: string[];
    validFrom: string;
    validUntil: string | null;
    verificationState: string;
  }>;
}

export const CARGO_READY_DECISION_CODES = [
  "approved",
  "approved_with_conditions",
  "blocked",
  "evidence_required",
] as const;
export type CargoReadyDecisionCode =
  (typeof CARGO_READY_DECISION_CODES)[number];

export type CargoReadyFindingCode =
  | "CARGO_ALLOCATION_MISSING"
  | "PRODUCT_COMPLIANCE_PROFILE_MISSING"
  | "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED"
  | "BATTERY_CLASSIFICATION_UNDETERMINED"
  | "REFRIGERANT_CLASSIFICATION_UNDETERMINED"
  | "DANGEROUS_GOODS_CLASSIFICATION_UNDETERMINED"
  | "INSPECTION_REQUIREMENT_UNDETERMINED"
  | "COMPLIANCE_RULE_COVERAGE_MISSING"
  | "COMPLIANCE_RULE_APPLICABILITY_UNCOVERED"
  | "RULE_APPLICABILITY_UNDETERMINED"
  | "REQUIRED_CERTIFICATE_MISSING_OR_INVALID";

export interface CargoReadyAssessmentItemSnapshot {
  replenishmentOrderLineId: string;
  productSkuId: string;
  productNumber: string;
  complianceProfileId: string | null;
  complianceProfileVersion: number | null;
}

export interface CargoReadyFinding {
  code: CargoReadyFindingCode;
  productSkuId: string | null;
  ruleVersionId: string | null;
  detail: string;
}

export interface CargoReadyRuleSnapshot {
  ruleVersionId: string;
  ruleCode: string;
  version: number;
  productSkuId: string;
  requirementLayer: string;
  requiredCertificateTypes: string[];
  blockingNodeCodes: string[];
  severity: string;
  officialSourceUrl: string;
  legalCitation: string;
}

export interface CreateCargoReadyAssessmentCommand {
  tenantId: string;
  containerRecordId: string;
  jurisdictionCountryCode: string;
  assessmentDate: string;
  expectedAssessmentVersion: number;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedCargoReadyAssessment {
  tenantId: string;
  containerRecordId: string;
  jurisdictionCountryCode: string;
  assessmentDate: string;
  expectedAssessmentVersion: number;
  allocationSetId: string | null;
  allocationSetVersion: number | null;
  items: CargoReadyAssessmentItemSnapshot[];
  ruleSnapshots: CargoReadyRuleSnapshot[];
  findings: CargoReadyFinding[];
  state: "action_required" | "ready_for_decision";
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
  payloadHash: string;
}

export interface DecideCargoReadyComplianceCommand {
  tenantId: string;
  containerRecordId: string;
  assessmentId: string;
  expectedDecisionVersion: number;
  decisionCode: CargoReadyDecisionCode;
  conditionRefs?: string[];
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedCargoReadyDecision extends DecideCargoReadyComplianceCommand {
  conditionRefs: string[];
  payloadHash: string;
}

export class CargoReadyComplianceValidationError extends Error {}

export function assertCargoReadyAssessmentCommand(
  input: CreateCargoReadyAssessmentCommand,
): void {
  normalizeAssessmentCommand(input);
}

export function buildCargoReadyAssessment(input: {
  command: CreateCargoReadyAssessmentCommand;
  scope: CargoScopeInput | null;
  profiles: Map<string, ComplianceProfileInput | null>;
  ruleEvaluation: {
    ruleSnapshots: CargoReadyRuleSnapshot[];
    findings: CargoReadyFinding[];
  };
}): NormalizedCargoReadyAssessment {
  const command = normalizeAssessmentCommand(input.command);
  const items: CargoReadyAssessmentItemSnapshot[] =
    input.scope?.items.map((item) => {
      const profile = input.profiles.get(item.productSkuId) ?? null;
      return {
        replenishmentOrderLineId: item.replenishmentOrderLineId,
        productSkuId: item.productSkuId,
        productNumber: item.productNumber,
        complianceProfileId: profile?.profileId ?? null,
        complianceProfileVersion: profile?.version ?? null,
      };
    }) ?? [];
  const findings = [
    ...evaluateBaselineFindings(input.scope, input.profiles),
    ...input.ruleEvaluation.findings,
  ];
  const normalizedWithoutHash = {
    ...command,
    allocationSetId: input.scope?.allocationSetId ?? null,
    allocationSetVersion: input.scope?.allocationSetVersion ?? null,
    items,
    ruleSnapshots: input.ruleEvaluation.ruleSnapshots,
    findings,
    state:
      findings.length === 0
        ? ("ready_for_decision" as const)
        : ("action_required" as const),
  };
  return {
    ...normalizedWithoutHash,
    payloadHash: sha256({
      contractVersion: "cargo-ready-assessment-v1",
      ...normalizedWithoutHash,
      idempotencyKey: undefined,
    }),
  };
}

export function normalizeCargoReadyDecision(
  input: DecideCargoReadyComplianceCommand,
): NormalizedCargoReadyDecision {
  const decisionCode = enumValue(
    input.decisionCode,
    CARGO_READY_DECISION_CODES,
    "decisionCode",
  );
  const conditionRefs = optionalUniqueTextList(
    input.conditionRefs ?? [],
    "conditionRefs",
    256,
  );
  if (
    (decisionCode === "approved_with_conditions") !==
    conditionRefs.length > 0
  ) {
    throw new CargoReadyComplianceValidationError(
      "VALIDATION_CONFLICT: conditionRefs",
    );
  }
  const normalizedWithoutHash = {
    tenantId: text(input.tenantId, "tenantId", 128),
    containerRecordId: text(input.containerRecordId, "containerRecordId", 128),
    assessmentId: uuid(input.assessmentId, "assessmentId"),
    expectedDecisionVersion: nonNegativeInteger(
      input.expectedDecisionVersion,
      "expectedDecisionVersion",
    ),
    decisionCode,
    conditionRefs,
    evidenceRefs: uniqueTextList(input.evidenceRefs, "evidenceRefs", 256),
    actorId: text(input.actorId, "actorId", 128),
    reasonCode: text(input.reasonCode, "reasonCode", 64),
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
  };
  return {
    ...normalizedWithoutHash,
    payloadHash: sha256({
      contractVersion: "cargo-ready-decision-v1",
      ...normalizedWithoutHash,
      idempotencyKey: undefined,
    }),
  };
}

export function assessmentMatchesCurrentInputs(input: {
  allocationSetId: string | null;
  items: CargoReadyAssessmentItemSnapshot[];
  ruleSnapshots: CargoReadyRuleSnapshot[];
  scope: CargoScopeInput | null;
  profiles: Map<string, ComplianceProfileInput | null>;
  currentRuleSnapshots: CargoReadyRuleSnapshot[];
}): boolean {
  if (!input.scope || input.allocationSetId !== input.scope.allocationSetId) {
    return false;
  }
  if (input.items.length !== input.scope.items.length) return false;
  const expected = [...input.items].sort(itemOrder);
  const current = input.scope.items
    .map((item) => {
      const profile = input.profiles.get(item.productSkuId) ?? null;
      return {
        replenishmentOrderLineId: item.replenishmentOrderLineId,
        productSkuId: item.productSkuId,
        productNumber: item.productNumber,
        complianceProfileId: profile?.profileId ?? null,
        complianceProfileVersion: profile?.version ?? null,
      };
    })
    .sort(itemOrder);
  return (
    JSON.stringify(expected) === JSON.stringify(current) &&
    JSON.stringify([...input.ruleSnapshots].sort(ruleSnapshotOrder)) ===
      JSON.stringify([...input.currentRuleSnapshots].sort(ruleSnapshotOrder))
  );
}

function evaluateBaselineFindings(
  scope: CargoScopeInput | null,
  profiles: Map<string, ComplianceProfileInput | null>,
): CargoReadyFinding[] {
  if (!scope || scope.items.length === 0) {
    return [
      {
        code: "CARGO_ALLOCATION_MISSING",
        productSkuId: null,
        ruleVersionId: null,
        detail: "cargo_ready requires an active cargo allocation snapshot",
      },
    ];
  }
  const findings: CargoReadyFinding[] = [];
  for (const productSkuId of [
    ...new Set(scope.items.map((item) => item.productSkuId)),
  ].sort()) {
    const profile = profiles.get(productSkuId) ?? null;
    if (!profile) {
      findings.push({
        code: "PRODUCT_COMPLIANCE_PROFILE_MISSING",
        productSkuId,
        ruleVersionId: null,
        detail: "current product compliance profile is missing",
      });
      continue;
    }
    if (profile.verificationState !== "verified") {
      findings.push({
        code: "PRODUCT_COMPLIANCE_PROFILE_UNVERIFIED",
        productSkuId,
        ruleVersionId: null,
        detail: `profile verification state is ${profile.verificationState}`,
      });
    }
    if (profile.battery.presenceState === "unknown") {
      findings.push({
        code: "BATTERY_CLASSIFICATION_UNDETERMINED",
        productSkuId,
        ruleVersionId: null,
        detail: "battery presence is unknown",
      });
    }
    if (profile.refrigerant.presenceState === "unknown") {
      findings.push({
        code: "REFRIGERANT_CLASSIFICATION_UNDETERMINED",
        productSkuId,
        ruleVersionId: null,
        detail: "refrigerant presence is unknown",
      });
    }
    if (profile.dangerousGoods.classificationState === "undetermined") {
      findings.push({
        code: "DANGEROUS_GOODS_CLASSIFICATION_UNDETERMINED",
        productSkuId,
        ruleVersionId: null,
        detail: "dangerous goods classification is undetermined",
      });
    }
    if (
      profile.inspectionRequirements.some(
        (requirement) => requirement.requirementState === "unknown",
      )
    ) {
      findings.push({
        code: "INSPECTION_REQUIREMENT_UNDETERMINED",
        productSkuId,
        ruleVersionId: null,
        detail: "at least one inspection requirement is unknown",
      });
    }
  }
  return findings;
}

function normalizeAssessmentCommand(
  input: CreateCargoReadyAssessmentCommand,
): Omit<
  NormalizedCargoReadyAssessment,
  | "allocationSetId"
  | "allocationSetVersion"
  | "items"
  | "ruleSnapshots"
  | "findings"
  | "state"
  | "payloadHash"
> {
  if (typeof input.jurisdictionCountryCode !== "string") {
    throw new CargoReadyComplianceValidationError(
      "VALIDATION_FORMAT: jurisdictionCountryCode",
    );
  }
  const jurisdictionCountryCode = input.jurisdictionCountryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(jurisdictionCountryCode)) {
    throw new CargoReadyComplianceValidationError(
      "VALIDATION_FORMAT: jurisdictionCountryCode",
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.assessmentDate)) {
    throw new CargoReadyComplianceValidationError(
      "VALIDATION_FORMAT: assessmentDate",
    );
  }
  const date = new Date(`${input.assessmentDate}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.assessmentDate
  ) {
    throw new CargoReadyComplianceValidationError(
      "VALIDATION_FORMAT: assessmentDate",
    );
  }
  return {
    tenantId: text(input.tenantId, "tenantId", 128),
    containerRecordId: text(input.containerRecordId, "containerRecordId", 128),
    jurisdictionCountryCode,
    assessmentDate: input.assessmentDate,
    expectedAssessmentVersion: nonNegativeInteger(
      input.expectedAssessmentVersion,
      "expectedAssessmentVersion",
    ),
    evidenceRefs: uniqueTextList(input.evidenceRefs, "evidenceRefs", 256),
    actorId: text(input.actorId, "actorId", 128),
    reasonCode: text(input.reasonCode, "reasonCode", 64),
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
  };
}

function ruleSnapshotOrder(
  left: CargoReadyRuleSnapshot,
  right: CargoReadyRuleSnapshot,
): number {
  return (
    left.productSkuId.localeCompare(right.productSkuId) ||
    left.ruleCode.localeCompare(right.ruleCode) ||
    left.version - right.version
  );
}

function text(value: string, field: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim()
  ) {
    throw new CargoReadyComplianceValidationError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value;
}

function uuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new CargoReadyComplianceValidationError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value.toLowerCase();
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CargoReadyComplianceValidationError(`VALIDATION_RANGE: ${field}`);
  }
  return value;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new CargoReadyComplianceValidationError(`VALIDATION_ENUM: ${field}`);
  }
  return value as T[number];
}

function uniqueTextList(
  values: string[],
  field: string,
  maxLength: number,
): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new CargoReadyComplianceValidationError(
      `VALIDATION_REQUIRED: ${field}`,
    );
  }
  return [
    ...new Set(values.map((value) => text(value, field, maxLength))),
  ].sort();
}

function optionalUniqueTextList(
  values: string[],
  field: string,
  maxLength: number,
): string[] {
  if (!Array.isArray(values)) {
    throw new CargoReadyComplianceValidationError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return [
    ...new Set(values.map((value) => text(value, field, maxLength))),
  ].sort();
}

function itemOrder(
  left: CargoReadyAssessmentItemSnapshot,
  right: CargoReadyAssessmentItemSnapshot,
): number {
  return left.replenishmentOrderLineId.localeCompare(
    right.replenishmentOrderLineId,
  );
}

function sha256(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
