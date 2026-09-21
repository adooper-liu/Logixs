import { createHash } from "node:crypto";
import type {
  CargoReadyAssessmentItemSnapshot,
  CargoReadyFinding,
  CargoReadyRuleSnapshot,
  ComplianceProfileInput,
} from "./cargo-ready-compliance";

export const COMPLIANCE_REQUIREMENT_LAYERS = [
  "law_regulation",
  "company_policy",
  "customer_requirement",
  "carrier_facility_requirement",
  "contract_obligation",
] as const;
export type ComplianceRequirementLayer =
  (typeof COMPLIANCE_REQUIREMENT_LAYERS)[number];

export const COMPLIANCE_RULE_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type ComplianceRuleSeverity =
  (typeof COMPLIANCE_RULE_SEVERITIES)[number];

export const PRESENCE_REQUIREMENTS = ["any", "present", "absent"] as const;
export type PresenceRequirement = (typeof PRESENCE_REQUIREMENTS)[number];

export const DANGEROUS_GOODS_REQUIREMENTS = [
  "any",
  "regulated",
  "not_regulated",
] as const;
export type DangerousGoodsRequirement =
  (typeof DANGEROUS_GOODS_REQUIREMENTS)[number];

export interface PublishComplianceRuleVersionCommand {
  tenantId: string;
  ruleCode: string;
  expectedVersion: number;
  requirementLayer: ComplianceRequirementLayer;
  jurisdictionCountryCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  appliesToAllSkus: boolean;
  productSkuIds?: string[];
  batteryRequirement?: PresenceRequirement;
  refrigerantRequirement?: PresenceRequirement;
  dangerousGoodsRequirement?: DangerousGoodsRequirement;
  requiredCertificateTypes?: string[];
  blockingNodeCodes: string[];
  severity: ComplianceRuleSeverity;
  officialSourceUrl: string;
  legalCitation: string;
  owner: string;
  evidenceRefs: string[];
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedComplianceRuleVersion {
  tenantId: string;
  ruleCode: string;
  expectedVersion: number;
  requirementLayer: ComplianceRequirementLayer;
  jurisdictionCountryCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  appliesToAllSkus: boolean;
  productSkuIds: string[];
  batteryRequirement: PresenceRequirement;
  refrigerantRequirement: PresenceRequirement;
  dangerousGoodsRequirement: DangerousGoodsRequirement;
  requiredCertificateTypes: string[];
  blockingNodeCodes: ["cargo_ready"];
  severity: ComplianceRuleSeverity;
  officialSourceUrl: string;
  legalCitation: string;
  owner: string;
  evidenceRefs: string[];
  approvedBy: string;
  reasonCode: string;
  idempotencyKey: string;
  payloadHash: string;
}

export interface PublishedComplianceRuleVersionRecord {
  ruleVersionId: string;
  ruleCode: string;
  version: number;
  requirementLayer: ComplianceRequirementLayer;
  jurisdictionCountryCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  appliesToAllSkus: boolean;
  productSkuIds: string[];
  batteryRequirement: PresenceRequirement;
  refrigerantRequirement: PresenceRequirement;
  dangerousGoodsRequirement: DangerousGoodsRequirement;
  requiredCertificateTypes: string[];
  blockingNodeCodes: string[];
  severity: ComplianceRuleSeverity;
  officialSourceUrl: string;
  legalCitation: string;
  owner: string;
  approvedBy: string;
  approvedAt: string;
}

export class ComplianceRuleValidationError extends Error {}

export function normalizeComplianceRuleVersion(
  input: PublishComplianceRuleVersionCommand,
): NormalizedComplianceRuleVersion {
  const ruleCode = text(input.ruleCode, "ruleCode", 64).toUpperCase();
  if (!/^[A-Z][A-Z0-9_.-]{2,63}$/.test(ruleCode)) {
    throw new ComplianceRuleValidationError("VALIDATION_FORMAT: ruleCode");
  }
  if (typeof input.jurisdictionCountryCode !== "string") {
    throw new ComplianceRuleValidationError(
      "VALIDATION_FORMAT: jurisdictionCountryCode",
    );
  }
  const jurisdictionCountryCode = input.jurisdictionCountryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(jurisdictionCountryCode)) {
    throw new ComplianceRuleValidationError(
      "VALIDATION_FORMAT: jurisdictionCountryCode",
    );
  }
  const effectiveFrom = dateOnly(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = input.effectiveTo
    ? dateOnly(input.effectiveTo, "effectiveTo")
    : null;
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new ComplianceRuleValidationError("VALIDATION_RANGE: effectiveTo");
  }
  if (typeof input.appliesToAllSkus !== "boolean") {
    throw new ComplianceRuleValidationError(
      "VALIDATION_FORMAT: appliesToAllSkus",
    );
  }
  const productSkuIds = uniqueUuidList(
    input.productSkuIds ?? [],
    "productSkuIds",
  );
  if (
    (input.appliesToAllSkus && productSkuIds.length > 0) ||
    (!input.appliesToAllSkus && productSkuIds.length === 0)
  ) {
    throw new ComplianceRuleValidationError(
      "VALIDATION_CONFLICT: productSkuIds",
    );
  }
  const blockingNodeCodes = uniqueTextList(
    input.blockingNodeCodes,
    "blockingNodeCodes",
    64,
    true,
  );
  if (
    blockingNodeCodes.length !== 1 ||
    blockingNodeCodes[0] !== "cargo_ready"
  ) {
    throw new ComplianceRuleValidationError(
      "VALIDATION_ENUM: blockingNodeCodes",
    );
  }
  const officialSourceUrl = httpsUrl(input.officialSourceUrl);
  const normalizedWithoutHash = {
    tenantId: text(input.tenantId, "tenantId", 128),
    ruleCode,
    expectedVersion: nonNegativeInteger(
      input.expectedVersion,
      "expectedVersion",
    ),
    requirementLayer: enumValue(
      input.requirementLayer,
      COMPLIANCE_REQUIREMENT_LAYERS,
      "requirementLayer",
    ),
    jurisdictionCountryCode,
    effectiveFrom,
    effectiveTo,
    appliesToAllSkus: input.appliesToAllSkus,
    productSkuIds,
    batteryRequirement: enumValue(
      input.batteryRequirement ?? "any",
      PRESENCE_REQUIREMENTS,
      "batteryRequirement",
    ),
    refrigerantRequirement: enumValue(
      input.refrigerantRequirement ?? "any",
      PRESENCE_REQUIREMENTS,
      "refrigerantRequirement",
    ),
    dangerousGoodsRequirement: enumValue(
      input.dangerousGoodsRequirement ?? "any",
      DANGEROUS_GOODS_REQUIREMENTS,
      "dangerousGoodsRequirement",
    ),
    requiredCertificateTypes: uniqueTextList(
      input.requiredCertificateTypes ?? [],
      "requiredCertificateTypes",
      64,
      false,
    ),
    blockingNodeCodes: ["cargo_ready"] as ["cargo_ready"],
    severity: enumValue(input.severity, COMPLIANCE_RULE_SEVERITIES, "severity"),
    officialSourceUrl,
    legalCitation: text(input.legalCitation, "legalCitation", 500),
    owner: text(input.owner, "owner", 128),
    evidenceRefs: uniqueTextList(input.evidenceRefs, "evidenceRefs", 256, true),
    approvedBy: text(input.actorId, "actorId", 128),
    reasonCode: text(input.reasonCode, "reasonCode", 64),
    idempotencyKey: text(input.idempotencyKey, "idempotencyKey", 200),
  };
  return {
    ...normalizedWithoutHash,
    payloadHash: sha256({
      contractVersion: "compliance-rule-version-v1",
      ...normalizedWithoutHash,
      idempotencyKey: undefined,
    }),
  };
}

export function evaluateComplianceRuleApplicability(input: {
  jurisdictionCountryCode: string;
  assessmentDate: string;
  items: CargoReadyAssessmentItemSnapshot[];
  profiles: Map<string, ComplianceProfileInput | null>;
  rules: PublishedComplianceRuleVersionRecord[];
}): { ruleSnapshots: CargoReadyRuleSnapshot[]; findings: CargoReadyFinding[] } {
  if (input.rules.length === 0) {
    return {
      ruleSnapshots: [],
      findings: [
        {
          code: "COMPLIANCE_RULE_COVERAGE_MISSING",
          productSkuId: null,
          ruleVersionId: null,
          detail: `no published cargo_ready rule covers ${input.jurisdictionCountryCode} on ${input.assessmentDate}`,
        },
      ],
    };
  }

  const ruleSnapshots: CargoReadyRuleSnapshot[] = [];
  const findings: CargoReadyFinding[] = [];
  const uniqueSkuIds = [
    ...new Set(input.items.map((item) => item.productSkuId)),
  ].sort();

  for (const productSkuId of uniqueSkuIds) {
    const profile = input.profiles.get(productSkuId) ?? null;
    let applicableCount = 0;
    let undeterminedCount = 0;
    for (const rule of input.rules) {
      if (!ruleAppliesToSku(rule, productSkuId)) continue;
      const attributeResult = evaluateAttributePredicates(rule, profile);
      if (attributeResult === "not_applicable") continue;
      if (attributeResult === "undetermined") {
        undeterminedCount += 1;
        findings.push({
          code: "RULE_APPLICABILITY_UNDETERMINED",
          productSkuId,
          ruleVersionId: rule.ruleVersionId,
          detail: `rule ${rule.ruleCode} v${rule.version} cannot be evaluated from the current verified profile`,
        });
        continue;
      }

      applicableCount += 1;
      ruleSnapshots.push(toRuleSnapshot(rule, productSkuId));
      for (const certificateType of rule.requiredCertificateTypes) {
        if (
          !hasValidCertificate({
            profile,
            certificateType,
            jurisdictionCountryCode: input.jurisdictionCountryCode,
            assessmentDate: input.assessmentDate,
          })
        ) {
          findings.push({
            code: "REQUIRED_CERTIFICATE_MISSING_OR_INVALID",
            productSkuId,
            ruleVersionId: rule.ruleVersionId,
            detail: `rule ${rule.ruleCode} v${rule.version} requires a verified ${certificateType} certificate valid for ${input.jurisdictionCountryCode}`,
          });
        }
      }
    }
    if (applicableCount === 0 && undeterminedCount === 0) {
      findings.push({
        code: "COMPLIANCE_RULE_APPLICABILITY_UNCOVERED",
        productSkuId,
        ruleVersionId: null,
        detail:
          "no published rule establishes cargo_ready coverage for this SKU",
      });
    }
  }

  return {
    ruleSnapshots: ruleSnapshots.sort(ruleSnapshotOrder),
    findings: findings.sort(findingOrder),
  };
}

function ruleAppliesToSku(
  rule: PublishedComplianceRuleVersionRecord,
  productSkuId: string,
): boolean {
  return rule.appliesToAllSkus || rule.productSkuIds.includes(productSkuId);
}

function evaluateAttributePredicates(
  rule: PublishedComplianceRuleVersionRecord,
  profile: ComplianceProfileInput | null,
): "applicable" | "not_applicable" | "undetermined" {
  if (!profile) return "undetermined";
  const battery = presencePredicate(
    rule.batteryRequirement,
    profile.battery.presenceState,
  );
  const refrigerant = presencePredicate(
    rule.refrigerantRequirement,
    profile.refrigerant.presenceState,
  );
  const dangerousGoods = dangerousGoodsPredicate(
    rule.dangerousGoodsRequirement,
    profile.dangerousGoods.classificationState,
  );
  if ([battery, refrigerant, dangerousGoods].includes("undetermined")) {
    return "undetermined";
  }
  if ([battery, refrigerant, dangerousGoods].includes("no")) {
    return "not_applicable";
  }
  return "applicable";
}

function presencePredicate(
  requirement: PresenceRequirement,
  actual: string,
): "yes" | "no" | "undetermined" {
  if (requirement === "any") return "yes";
  if (actual === "unknown") return "undetermined";
  return actual === requirement ? "yes" : "no";
}

function dangerousGoodsPredicate(
  requirement: DangerousGoodsRequirement,
  actual: string,
): "yes" | "no" | "undetermined" {
  if (requirement === "any") return "yes";
  if (actual === "undetermined") return "undetermined";
  return actual === requirement ? "yes" : "no";
}

function hasValidCertificate(input: {
  profile: ComplianceProfileInput | null;
  certificateType: string;
  jurisdictionCountryCode: string;
  assessmentDate: string;
}): boolean {
  return (
    input.profile?.certificates.some(
      (certificate) =>
        certificate.certificateType === input.certificateType &&
        certificate.verificationState === "verified" &&
        certificate.validFrom <= input.assessmentDate &&
        (!certificate.validUntil ||
          certificate.validUntil >= input.assessmentDate) &&
        (certificate.coverageScope === "global" ||
          certificate.coveredCountryCodes.includes(
            input.jurisdictionCountryCode,
          )),
    ) ?? false
  );
}

function toRuleSnapshot(
  rule: PublishedComplianceRuleVersionRecord,
  productSkuId: string,
): CargoReadyRuleSnapshot {
  return {
    ruleVersionId: rule.ruleVersionId,
    ruleCode: rule.ruleCode,
    version: rule.version,
    productSkuId,
    requirementLayer: rule.requirementLayer,
    requiredCertificateTypes: rule.requiredCertificateTypes,
    blockingNodeCodes: rule.blockingNodeCodes,
    severity: rule.severity,
    officialSourceUrl: rule.officialSourceUrl,
    legalCitation: rule.legalCitation,
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

function findingOrder(left: CargoReadyFinding, right: CargoReadyFinding) {
  return (
    (left.productSkuId ?? "").localeCompare(right.productSkuId ?? "") ||
    left.code.localeCompare(right.code) ||
    (left.ruleVersionId ?? "").localeCompare(right.ruleVersionId ?? "")
  );
}

function text(value: string, field: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim()
  ) {
    throw new ComplianceRuleValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return value;
}

function dateOnly(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ComplianceRuleValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ComplianceRuleValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ComplianceRuleValidationError(`VALIDATION_RANGE: ${field}`);
  }
  return value;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new ComplianceRuleValidationError(`VALIDATION_ENUM: ${field}`);
  }
  return value as T[number];
}

function uniqueTextList(
  values: string[],
  field: string,
  maxLength: number,
  required: boolean,
): string[] {
  if (!Array.isArray(values) || (required && values.length === 0)) {
    throw new ComplianceRuleValidationError(`VALIDATION_REQUIRED: ${field}`);
  }
  return [
    ...new Set(values.map((value) => text(value, field, maxLength))),
  ].sort();
}

function uniqueUuidList(values: string[], field: string): string[] {
  if (!Array.isArray(values)) {
    throw new ComplianceRuleValidationError(`VALIDATION_FORMAT: ${field}`);
  }
  return [
    ...new Set(
      values.map((value) => {
        if (!UUID_PATTERN.test(value)) {
          throw new ComplianceRuleValidationError(
            `VALIDATION_FORMAT: ${field}`,
          );
        }
        return value.toLowerCase();
      }),
    ),
  ].sort();
}

function httpsUrl(value: string): string {
  const normalized = text(value, "officialSourceUrl", 1_000);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new ComplianceRuleValidationError(
      "VALIDATION_FORMAT: officialSourceUrl",
    );
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new ComplianceRuleValidationError(
      "VALIDATION_FORMAT: officialSourceUrl",
    );
  }
  return parsed.toString();
}

function sha256(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
