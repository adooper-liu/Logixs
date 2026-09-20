import { createHash } from "node:crypto";

export const PRESENCE_STATES = ["present", "absent", "unknown"] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export const INGESTION_CHANNELS = [
  "api",
  "webhook",
  "file_import",
  "manual_ui",
] as const;
export type ComplianceIngestionChannel = (typeof INGESTION_CHANNELS)[number];

export const BATTERY_PACKING_MODES = [
  "battery_only",
  "packed_with_equipment",
  "contained_in_equipment",
] as const;
export type BatteryPackingMode = (typeof BATTERY_PACKING_MODES)[number];

export const DG_CLASSIFICATION_STATES = [
  "regulated",
  "not_regulated",
  "undetermined",
] as const;
export type DangerousGoodsClassificationState =
  (typeof DG_CLASSIFICATION_STATES)[number];

export const INSPECTION_REQUIREMENT_TYPES = [
  "commodity_inspection",
  "phytosanitary",
  "fumigation",
  "sanitary",
  "veterinary",
  "food_safety",
] as const;
export type InspectionRequirementType =
  (typeof INSPECTION_REQUIREMENT_TYPES)[number];

export const REQUIREMENT_STATES = [
  "required",
  "not_required",
  "unknown",
] as const;
export type RequirementState = (typeof REQUIREMENT_STATES)[number];

export const CERTIFICATE_TYPES = [
  "un38_3",
  "sds",
  "transport_safety_assessment",
  "ce",
  "ukca",
  "fcc",
  "cpsc",
  "rohs",
  "reach",
  "weee",
  "epr",
  "battery_regulation",
  "certificate_of_origin",
  "wood_origin",
  "phytosanitary_certificate",
  "fumigation_certificate",
  "commodity_inspection_certificate",
  "veterinary_certificate",
  "sanitary_certificate",
  "food_safety_certificate",
] as const;
export type ProductCertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_VERIFICATION_STATES = [
  "pending",
  "verified",
  "rejected",
  "revoked",
] as const;
export type CertificateVerificationState =
  (typeof CERTIFICATE_VERIFICATION_STATES)[number];

export interface BatteryProfileInput {
  presenceState: PresenceState;
  chemistryCode?: string | null;
  modelNumber?: string | null;
  cellCount?: number | null;
  batteryCount?: number | null;
  wattHours?: string | null;
  lithiumContentGrams?: string | null;
  removable?: boolean | null;
  packingMode?: BatteryPackingMode | null;
}

export interface RefrigerantProfileInput {
  presenceState: PresenceState;
  refrigerantCode?: string | null;
  chargeQuantity?: string | null;
  chargeUnit?: string | null;
  globalWarmingPotential?: string | null;
  hermeticallySealed?: boolean | null;
}

export interface DangerousGoodsProfileInput {
  classificationState: DangerousGoodsClassificationState;
  unNumber?: string | null;
  properShippingName?: string | null;
  hazardClass?: string | null;
  division?: string | null;
  packingGroup?: "I" | "II" | "III" | null;
  marinePollutant?: boolean | null;
  flashPointCelsius?: string | null;
}

export interface InspectionRequirementInput {
  requirementType: InspectionRequirementType;
  requirementState: RequirementState;
  jurisdictionCountryCode?: string | null;
  notes?: string | null;
}

export interface ProductCertificateInput {
  certificateKey: string;
  certificateType: ProductCertificateType;
  certificateNumber: string;
  issuerName: string;
  coverageScope: "global" | "countries";
  coveredCountryCodes: string[];
  validFrom: string;
  validUntil?: string | null;
  documentRecordId: string;
  verificationState: CertificateVerificationState;
}

export interface ReplaceProductComplianceProfileCommand {
  tenantId: string;
  productSkuId: string;
  expectedProfileVersion: number;
  battery: BatteryProfileInput;
  refrigerant: RefrigerantProfileInput;
  dangerousGoods: DangerousGoodsProfileInput;
  inspectionRequirements: InspectionRequirementInput[];
  certificates: ProductCertificateInput[];
  ingestionChannel: ComplianceIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  verificationState: CertificateVerificationState;
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
}

export interface NormalizedBatteryProfile {
  presenceState: PresenceState;
  chemistryCode: string | null;
  modelNumber: string | null;
  cellCount: number | null;
  batteryCount: number | null;
  wattHours: string | null;
  lithiumContentGrams: string | null;
  removable: boolean | null;
  packingMode: BatteryPackingMode | null;
}

export interface NormalizedRefrigerantProfile {
  presenceState: PresenceState;
  refrigerantCode: string | null;
  chargeQuantity: string | null;
  chargeUnit: string | null;
  globalWarmingPotential: string | null;
  hermeticallySealed: boolean | null;
}

export interface NormalizedDangerousGoodsProfile {
  classificationState: DangerousGoodsClassificationState;
  unNumber: string | null;
  properShippingName: string | null;
  hazardClass: string | null;
  division: string | null;
  packingGroup: "I" | "II" | "III" | null;
  marinePollutant: boolean | null;
  flashPointCelsius: string | null;
}

export interface NormalizedInspectionRequirement {
  requirementType: InspectionRequirementType;
  requirementState: RequirementState;
  jurisdictionCountryCode: string | null;
  notes: string | null;
}

export interface NormalizedProductCertificate {
  certificateKey: string;
  certificateType: ProductCertificateType;
  certificateNumber: string;
  issuerName: string;
  coverageScope: "global" | "countries";
  coveredCountryCodes: string[];
  validFrom: string;
  validUntil: string | null;
  documentRecordId: string;
  verificationState: CertificateVerificationState;
  payloadHash: string;
}

export interface NormalizedReplaceProductComplianceProfileCommand {
  tenantId: string;
  productSkuId: string;
  expectedProfileVersion: number;
  battery: NormalizedBatteryProfile;
  refrigerant: NormalizedRefrigerantProfile;
  dangerousGoods: NormalizedDangerousGoodsProfile;
  inspectionRequirements: NormalizedInspectionRequirement[];
  certificates: NormalizedProductCertificate[];
  ingestionChannel: ComplianceIngestionChannel;
  sourceSystem: string;
  evidenceRefs: string[];
  verificationState: CertificateVerificationState;
  actorId: string;
  reasonCode: string;
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductComplianceProfileCommandError extends Error {}

export function normalizeReplaceProductComplianceProfileCommand(
  input: ReplaceProductComplianceProfileCommand,
): NormalizedReplaceProductComplianceProfileCommand {
  const tenantId = validatedText(input.tenantId, "tenantId", 128);
  const productSkuId = validatedUuid(input.productSkuId, "productSkuId");
  if (
    !Number.isInteger(input.expectedProfileVersion) ||
    input.expectedProfileVersion < 0
  ) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_RANGE: expectedProfileVersion",
    );
  }
  const battery = normalizeBattery(input.battery);
  const refrigerant = normalizeRefrigerant(input.refrigerant);
  const dangerousGoods = normalizeDangerousGoods(input.dangerousGoods);
  const inspectionRequirements = input.inspectionRequirements
    .map(normalizeInspectionRequirement)
    .sort((left, right) =>
      inspectionKey(left).localeCompare(inspectionKey(right)),
    );
  ensureUnique(
    inspectionRequirements.map(inspectionKey),
    "inspectionRequirements",
  );
  const certificates = input.certificates
    .map(normalizeCertificate)
    .sort((left, right) =>
      left.certificateKey.localeCompare(right.certificateKey),
    );
  ensureUnique(
    certificates.map((certificate) => certificate.certificateKey),
    "certificates",
  );
  const ingestionChannel = validatedEnum(
    input.ingestionChannel,
    INGESTION_CHANNELS,
    "ingestionChannel",
  );
  const sourceSystem = validatedText(input.sourceSystem, "sourceSystem", 128);
  const evidenceRefs = normalizedUniqueTextList(
    input.evidenceRefs,
    "evidenceRefs",
    256,
    true,
  );
  const verificationState = validatedEnum(
    input.verificationState,
    CERTIFICATE_VERIFICATION_STATES,
    "verificationState",
  );
  const actorId = validatedText(input.actorId, "actorId", 128);
  const reasonCode = validatedText(input.reasonCode, "reasonCode", 64);
  const idempotencyKey = validatedText(
    input.idempotencyKey,
    "idempotencyKey",
    200,
  );
  const normalizedWithoutHash = {
    tenantId,
    productSkuId,
    expectedProfileVersion: input.expectedProfileVersion,
    battery,
    refrigerant,
    dangerousGoods,
    inspectionRequirements,
    certificates,
    ingestionChannel,
    sourceSystem,
    evidenceRefs,
    verificationState,
    actorId,
    reasonCode,
    idempotencyKey,
  };
  return {
    ...normalizedWithoutHash,
    payloadHash: sha256({
      contractVersion: "product-compliance-profile-v1",
      ...normalizedWithoutHash,
      idempotencyKey: undefined,
    }),
  };
}

function normalizeBattery(
  input: BatteryProfileInput,
): NormalizedBatteryProfile {
  const presenceState = validatedEnum(
    input.presenceState,
    PRESENCE_STATES,
    "battery.presenceState",
  );
  const details: Omit<NormalizedBatteryProfile, "presenceState"> = {
    chemistryCode: optionalText(
      input.chemistryCode,
      "battery.chemistryCode",
      64,
    ),
    modelNumber: optionalText(input.modelNumber, "battery.modelNumber", 128),
    cellCount: optionalPositiveInteger(input.cellCount, "battery.cellCount"),
    batteryCount: optionalPositiveInteger(
      input.batteryCount,
      "battery.batteryCount",
    ),
    wattHours: optionalPositiveDecimal(input.wattHours, "battery.wattHours"),
    lithiumContentGrams: optionalPositiveDecimal(
      input.lithiumContentGrams,
      "battery.lithiumContentGrams",
    ),
    removable: optionalBoolean(input.removable, "battery.removable"),
    packingMode:
      input.packingMode == null
        ? null
        : validatedEnum(
            input.packingMode,
            BATTERY_PACKING_MODES,
            "battery.packingMode",
          ),
  };
  if (presenceState !== "present") {
    rejectDetails(details, "battery");
  } else if (
    !details.chemistryCode ||
    details.batteryCount === null ||
    details.removable === null ||
    !details.packingMode
  ) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_REQUIRED: battery present details",
    );
  }
  return { presenceState, ...details };
}

function normalizeRefrigerant(
  input: RefrigerantProfileInput,
): NormalizedRefrigerantProfile {
  const presenceState = validatedEnum(
    input.presenceState,
    PRESENCE_STATES,
    "refrigerant.presenceState",
  );
  const details: Omit<NormalizedRefrigerantProfile, "presenceState"> = {
    refrigerantCode: optionalText(
      input.refrigerantCode,
      "refrigerant.refrigerantCode",
      64,
    ),
    chargeQuantity: optionalPositiveDecimal(
      input.chargeQuantity,
      "refrigerant.chargeQuantity",
    ),
    chargeUnit: optionalText(input.chargeUnit, "refrigerant.chargeUnit", 32),
    globalWarmingPotential: optionalPositiveDecimal(
      input.globalWarmingPotential,
      "refrigerant.globalWarmingPotential",
    ),
    hermeticallySealed: optionalBoolean(
      input.hermeticallySealed,
      "refrigerant.hermeticallySealed",
    ),
  };
  if (presenceState !== "present") {
    rejectDetails(details, "refrigerant");
  } else if (
    !details.refrigerantCode ||
    !details.chargeQuantity ||
    !details.chargeUnit ||
    !details.globalWarmingPotential ||
    details.hermeticallySealed === null
  ) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_REQUIRED: refrigerant present details",
    );
  }
  return { presenceState, ...details };
}

function normalizeDangerousGoods(
  input: DangerousGoodsProfileInput,
): NormalizedDangerousGoodsProfile {
  const classificationState = validatedEnum(
    input.classificationState,
    DG_CLASSIFICATION_STATES,
    "dangerousGoods.classificationState",
  );
  const details: Omit<NormalizedDangerousGoodsProfile, "classificationState"> =
    {
      unNumber: optionalText(input.unNumber, "dangerousGoods.unNumber", 6),
      properShippingName: optionalText(
        input.properShippingName,
        "dangerousGoods.properShippingName",
        256,
      ),
      hazardClass: optionalText(
        input.hazardClass,
        "dangerousGoods.hazardClass",
        16,
      ),
      division: optionalText(input.division, "dangerousGoods.division", 16),
      packingGroup: input.packingGroup ?? null,
      marinePollutant: optionalBoolean(
        input.marinePollutant,
        "dangerousGoods.marinePollutant",
      ),
      flashPointCelsius: optionalSignedDecimal(
        input.flashPointCelsius,
        "dangerousGoods.flashPointCelsius",
      ),
    };
  if (
    details.packingGroup !== null &&
    !(["I", "II", "III"] as const).includes(details.packingGroup)
  ) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_ENUM: dangerousGoods.packingGroup",
    );
  }
  if (classificationState !== "regulated") {
    rejectDetails(details, "dangerousGoods");
  } else if (
    !details.unNumber ||
    !/^UN\d{4}$/.test(details.unNumber) ||
    !details.properShippingName ||
    !details.hazardClass ||
    details.marinePollutant === null
  ) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_REQUIRED: dangerous goods regulated details",
    );
  }
  return { classificationState, ...details };
}

function normalizeInspectionRequirement(
  input: InspectionRequirementInput,
): NormalizedInspectionRequirement {
  return {
    requirementType: validatedEnum(
      input.requirementType,
      INSPECTION_REQUIREMENT_TYPES,
      "inspectionRequirement.requirementType",
    ),
    requirementState: validatedEnum(
      input.requirementState,
      REQUIREMENT_STATES,
      "inspectionRequirement.requirementState",
    ),
    jurisdictionCountryCode: optionalCountryCode(input.jurisdictionCountryCode),
    notes: optionalText(input.notes, "inspectionRequirement.notes", 1000),
  };
}

function normalizeCertificate(
  input: ProductCertificateInput,
): NormalizedProductCertificate {
  const coverageScope = validatedEnum(
    input.coverageScope,
    ["global", "countries"] as const,
    "certificate.coverageScope",
  );
  const coveredCountryCodes = normalizedCountryCodes(input.coveredCountryCodes);
  if (
    (coverageScope === "global" && coveredCountryCodes.length !== 0) ||
    (coverageScope === "countries" && coveredCountryCodes.length === 0)
  ) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_SCOPE: certificate.coveredCountryCodes",
    );
  }
  const validFrom = validatedDate(input.validFrom, "certificate.validFrom");
  const validUntil =
    input.validUntil == null
      ? null
      : validatedDate(input.validUntil, "certificate.validUntil");
  if (validUntil && validUntil < validFrom) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_RANGE: certificate.validUntil",
    );
  }
  const normalizedWithoutHash = {
    certificateKey: validatedText(
      input.certificateKey,
      "certificate.certificateKey",
      128,
    ),
    certificateType: validatedEnum(
      input.certificateType,
      CERTIFICATE_TYPES,
      "certificate.certificateType",
    ),
    certificateNumber: validatedText(
      input.certificateNumber,
      "certificate.certificateNumber",
      128,
    ),
    issuerName: validatedText(input.issuerName, "certificate.issuerName", 200),
    coverageScope,
    coveredCountryCodes,
    validFrom,
    validUntil,
    documentRecordId: validatedUuid(
      input.documentRecordId,
      "certificate.documentRecordId",
    ),
    verificationState: validatedEnum(
      input.verificationState,
      CERTIFICATE_VERIFICATION_STATES,
      "certificate.verificationState",
    ),
  };
  return {
    ...normalizedWithoutHash,
    payloadHash: sha256({
      contractVersion: "product-certificate-version-v1",
      ...normalizedWithoutHash,
    }),
  };
}

function inspectionKey(input: NormalizedInspectionRequirement): string {
  return `${input.requirementType}:${input.jurisdictionCountryCode ?? "*"}`;
}

function rejectDetails(input: Record<string, unknown>, field: string): void {
  if (Object.values(input).some((value) => value !== null)) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_CONFLICT: ${field} details without present state`,
    );
  }
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
    containsControlCharacter(value)
  ) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  return value == null ? null : validatedText(value, field, maxLength);
}

function validatedUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value.toLowerCase();
}

function validatedEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ProductComplianceProfileCommandError(`VALIDATION_ENUM: ${field}`);
  }
  return value as T[number];
}

function optionalPositiveInteger(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_RANGE: ${field}`,
    );
  }
  return value;
}

function optionalBoolean(
  value: boolean | null | undefined,
  field: string,
): boolean | null {
  if (value == null) return null;
  if (typeof value !== "boolean") {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value;
}

function optionalPositiveDecimal(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value == null) return null;
  if (!POSITIVE_DECIMAL_PATTERN.test(value) || Number(value) <= 0) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_RANGE: ${field}`,
    );
  }
  return canonicalDecimal(value);
}

function optionalSignedDecimal(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value == null) return null;
  if (!SIGNED_DECIMAL_PATTERN.test(value)) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return canonicalDecimal(value);
}

function canonicalDecimal(value: string): string {
  const [integer, fraction = ""] = value.split(".");
  const normalizedInteger = integer.replace(/^(-?)0+(?=\d)/, "$1");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction
    ? `${normalizedInteger}.${normalizedFraction}`
    : normalizedInteger;
}

function optionalCountryCode(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(normalized)) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_FORMAT: jurisdictionCountryCode",
    );
  }
  return normalized;
}

function normalizedCountryCodes(values: string[]): string[] {
  if (!Array.isArray(values)) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_FORMAT: certificate.coveredCountryCodes",
    );
  }
  const normalized = values.map((value) => optionalCountryCode(value));
  if (normalized.some((value) => value === null)) {
    throw new ProductComplianceProfileCommandError(
      "VALIDATION_FORMAT: certificate.coveredCountryCodes",
    );
  }
  return [...new Set(normalized as string[])].sort();
}

function validatedDate(value: string, field: string): string {
  if (!DATE_PATTERN.test(value)) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_FORMAT: ${field}`,
    );
  }
  return value;
}

function normalizedUniqueTextList(
  values: string[],
  field: string,
  maxLength: number,
  requireNonEmpty: boolean,
): string[] {
  if (!Array.isArray(values) || (requireNonEmpty && values.length === 0)) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_REQUIRED: ${field}`,
    );
  }
  return [
    ...new Set(values.map((value) => validatedText(value, field, maxLength))),
  ].sort();
}

function ensureUnique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new ProductComplianceProfileCommandError(
      `VALIDATION_DUPLICATE: ${field}`,
    );
  }
}

function sha256(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex");
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/;
const SIGNED_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/;
