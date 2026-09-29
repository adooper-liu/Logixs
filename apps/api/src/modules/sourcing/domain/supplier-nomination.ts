import { createHash } from "node:crypto";
import type {
  AdmitSupplierCommandV1,
  NominateSupplierCommandV1,
  RecordQuotationCommandV1,
  RegisterSupplierCommandV1,
  SupplierAdmissionStateV1,
  SupplierQuotationV1,
} from "@logix/contracts";

/**
 * 供应商准入、报价与定点。
 *
 * 三条贯穿的规矩：
 *
 * 1. **报价是十项，不是单价。** 其中六项是「条件」（贸易术语、MOQ、模具费、样品、
 *    交期、付款）—— 只比单价是外行比价，真实差异常在模具费谁承担、MOQ 多高。
 * 2. **关键物料由报价带入。** 自己编的是「声称」，供应商报的才是「承诺」。
 * 3. **没准入不能定点。** 没审过的对象不承担质量责任。
 */

export const SUPPLIER_ADMISSION_STATES: readonly SupplierAdmissionStateV1[] = [
  "pending",
  "admitted",
  "suspended",
];

export interface CurrentSupplier {
  version: number;
  admissionState: SupplierAdmissionStateV1;
}

export interface CurrentQuotation {
  version: number;
}

export interface PreparedSupplier {
  name: string;
  countryCode: string;
  contactName: string | null;
  contactEmail: string | null;
  admissionState: "pending";
  version: number;
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedAdmission {
  expectedSupplierVersion: number;
  version: number;
  admissionState: "admitted";
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedQuotation {
  expectedQuotationVersion: number;
  version: number;
  priceTiers: SupplierQuotationV1["priceTiers"];
  incoterms: string;
  minimumOrderQuantity: SupplierQuotationV1["minimumOrderQuantity"];
  toolingCost: SupplierQuotationV1["toolingCost"];
  sampleCost: SupplierQuotationV1["sampleCost"];
  sampleRefundable: boolean | null;
  leadTimeDays: number | null;
  packagingSpec: string | null;
  paymentTerms: string | null;
  qualityTerms: string | null;
  validUntil: Date | null;
  keyMaterials: SupplierQuotationV1["keyMaterials"];
  exclusions: string | null;
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedNomination {
  expectedQuotationVersion: number;
  quotationVersion: number;
  version: number;
  sampleConclusion: string;
  capacityConstraint: string;
  idempotencyKey: string;
  payloadHash: string;
}

export class SourcingValidationError extends Error {}
export class SourcingConflictError extends Error {}

export function prepareSupplierRegistration(
  actorId: string,
  command: RegisterSupplierCommandV1,
): PreparedSupplier {
  if (command.contractVersion !== "supplier-register.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  // 登记只建身份；准入必须另走授权动作，不能在登记时顺手勾上。
  if (command.admissionState !== "pending") {
    invalid("admissionState");
  }
  const normalized = {
    name: text(command.name, "name", 200),
    countryCode: countryCode(command.countryCode, "countryCode"),
    contactName: optionalText(command.contactName, "contactName", 100),
    contactEmail: optionalText(command.contactEmail, "contactEmail", 200),
    admissionState: "pending" as const,
    version: 1,
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function prepareSupplierAdmission(
  current: CurrentSupplier,
  actorId: string,
  command: AdmitSupplierCommandV1,
): PreparedAdmission {
  if (command.contractVersion !== "supplier-admit.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  const expectedSupplierVersion = requireVersion(
    current.version,
    command.expectedSupplierVersion,
  );
  if (current.admissionState === "admitted") {
    conflict("SUPPLIER_ALREADY_ADMITTED");
  }
  if (current.admissionState === "suspended") {
    conflict("SUPPLIER_SUSPENDED");
  }
  const normalized = {
    expectedSupplierVersion,
    version: current.version + 1,
    admissionState: "admitted" as const,
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function prepareQuotation(
  current: CurrentQuotation,
  actorId: string,
  command: RecordQuotationCommandV1,
): PreparedQuotation {
  if (command.contractVersion !== "supplier-quotation-record.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  const expectedQuotationVersion = requireVersion(
    current.version,
    command.expectedQuotationVersion,
  );
  const normalized = {
    expectedQuotationVersion,
    version: current.version + 1,
    priceTiers: priceTiers(command.priceTiers),
    incoterms: text(command.incoterms, "incoterms", 100),
    minimumOrderQuantity: command.minimumOrderQuantity ?? null,
    toolingCost: command.toolingCost ?? null,
    sampleCost: command.sampleCost ?? null,
    sampleRefundable: command.sampleRefundable ?? null,
    leadTimeDays: optionalCount(command.leadTimeDays, "leadTimeDays"),
    packagingSpec: optionalText(command.packagingSpec, "packagingSpec", 1000),
    paymentTerms: optionalText(command.paymentTerms, "paymentTerms", 500),
    qualityTerms: optionalText(command.qualityTerms, "qualityTerms", 1000),
    validUntil: optionalDate(command.validUntil, "validUntil"),
    keyMaterials: keyMaterials(command.keyMaterials),
    exclusions: optionalText(command.exclusions, "exclusions", 2000),
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

export function prepareNomination(
  supplier: CurrentSupplier,
  quotation: CurrentQuotation,
  actorId: string,
  command: NominateSupplierCommandV1,
): PreparedNomination {
  if (command.contractVersion !== "supplier-nominate.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  // **没准入不能定点** —— 没审过的对象不承担质量责任。
  if (supplier.admissionState !== "admitted") {
    conflict("SUPPLIER_NOT_ADMITTED");
  }
  const expectedQuotationVersion = requireVersion(
    quotation.version,
    command.expectedQuotationVersion,
  );
  const normalized = {
    expectedQuotationVersion,
    quotationVersion: quotation.version,
    version: quotation.version,
    sampleConclusion: text(command.sampleConclusion, "sampleConclusion", 1000),
    capacityConstraint: text(
      command.capacityConstraint,
      "capacityConstraint",
      1000,
    ),
    idempotencyKey: text(command.idempotencyKey, "idempotencyKey", 200),
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

/** 单价按数量阶梯。**只报一个价是比不了价的** —— 阶梯价才看得出量产后的成本曲线。 */
function priceTiers(
  values: RecordQuotationCommandV1["priceTiers"],
): SupplierQuotationV1["priceTiers"] {
  if (!Array.isArray(values) || values.length === 0) invalid("priceTiers");
  if (values.length > 20) invalid("priceTiers");
  const seen = new Set<number>();
  const tiers = values.map((tier) => {
    if (!Number.isSafeInteger(tier.minQuantity) || tier.minQuantity < 1) {
      invalid("priceTiers.minQuantity");
    }
    // 同一档出现两次，说明报重了 —— 明说，不静默取一个。
    if (seen.has(tier.minQuantity)) invalid("priceTiers.minQuantity（重复）");
    seen.add(tier.minQuantity);
    // **金额用定点十进制字符串**：浮点表示不了钱。
    if (
      typeof tier.unitPrice !== "string" ||
      !AMOUNT_PATTERN.test(tier.unitPrice)
    ) {
      invalid("priceTiers.unitPrice");
    }
    if (
      typeof tier.currency !== "string" ||
      !CURRENCY_PATTERN.test(tier.currency)
    ) {
      invalid("priceTiers.currency");
    }
    return {
      minQuantity: tier.minQuantity,
      unitPrice: tier.unitPrice,
      currency: tier.currency,
    };
  });
  // 上面已经断言过非空，这里的断言只是把"至少一档"告诉类型系统
  // （契约用 minItems 生成了元组类型）。
  return tiers.sort(
    (left, right) => left.minQuantity - right.minQuantity,
  ) as SupplierQuotationV1["priceTiers"];
}

function keyMaterials(
  values: RecordQuotationCommandV1["keyMaterials"],
): SupplierQuotationV1["keyMaterials"] {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > 200) invalid("keyMaterials");
  return values.map((material) => {
    if (
      !Number.isFinite(material.quantityPerUnit) ||
      material.quantityPerUnit <= 0
    ) {
      invalid("keyMaterials.quantityPerUnit");
    }
    const loss = material.lossRatePercent;
    if (loss !== null && loss !== undefined) {
      if (!Number.isFinite(loss) || loss < 0 || loss > 100) {
        invalid("keyMaterials.lossRatePercent");
      }
    }
    if (typeof material.suppliedByCustomer !== "boolean") {
      invalid("keyMaterials.suppliedByCustomer");
    }
    return {
      name: text(material.name, "keyMaterials.name", 200),
      specification: optionalText(
        material.specification,
        "keyMaterials.specification",
        500,
      ),
      quantityPerUnit: material.quantityPerUnit,
      quantityUnit: material.quantityUnit,
      lossRatePercent: loss ?? null,
      suppliedByCustomer: material.suppliedByCustomer,
    };
  });
}

function requireVersion(current: number, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid("expectedVersion");
  if (value !== current) conflict("SOURCING_VERSION_CONFLICT");
  return value;
}

function countryCode(value: string | null | undefined, field: string): string {
  const normalized = text(value, field, 2);
  if (!COUNTRY_PATTERN.test(normalized)) invalid(field);
  return normalized;
}

function optionalCount(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) invalid(field);
  return value;
}

function optionalDate(
  value: string | null | undefined,
  field: string,
): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid(field);
  return parsed;
}

function text(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, field, maxLength);
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function invalid(field: string): never {
  throw new SourcingValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new SourcingConflictError(code);
}

const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]{1,4})?$/;
