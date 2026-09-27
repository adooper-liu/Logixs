import { createHash } from "node:crypto";
import type {
  ProductAttributesV1,
  ProductIdentityDraftCommandV1,
  ProductIdentityPendingFieldCodeV1,
  SellableSkuReleaseCommandV1,
} from "@logix/contracts";

/**
 * 产品与 SKU 身份：把已发布的产品设计变成**可被下游稳定引用**的身份。
 *
 * 两条贯穿全篇的规矩：
 *
 * 1. **内部代理键与对外编号分列。** 内部键无业务含义、永不因业务变化而变；
 *    对外编号给人看、可改。把含义编进编号，改一次品类就要返工一次历史。
 * 2. **缺一项不该让人什么都存不下。** 主数据是逐步查清的，普通缺失进待补；
 *    只有**发布**那一刻才卡硬项 —— 因为发布是交给下游当依据的。
 */

export interface CurrentProductIdentity {
  version: number;
  productNumber: string | null;
  skuCount: number;
  attributes: ProductAttributesV1 | null;
}

export interface PreparedSkuDraft {
  /** 用户自带的内部键；没有时留 `null`，由落库补。 */
  skuId: string | null;
  skuCode: string;
  attributes: ProductIdentityDraftCommandV1["skus"][number]["attributes"];
}

export interface PreparedProductIdentityDraft {
  expectedVersion: number;
  version: number;
  productNumber: string;
  attributes: ProductAttributesV1;
  skus: PreparedSkuDraft[];
  pendingFieldCodes: ProductIdentityPendingFieldCodeV1[];
  idempotencyKey: string;
  payloadHash: string;
}

export interface PreparedSellableSkuRelease {
  expectedVersion: number;
  version: number;
  pendingFieldCodes: ProductIdentityPendingFieldCodeV1[];
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductIdentityValidationError extends Error {}
export class ProductIdentityConflictError extends Error {}

/**
 * 本片不产 BOM 与 Listing —— 它们各自需要业务定义。**如实带着**，
 * 不假装齐了，也不因此阻断发布（普通缺失不阻断）。
 */
export function productIdentityPendingFieldCodes(): ProductIdentityPendingFieldCodeV1[] {
  return ["bom", "listing"];
}

/**
 * 由来源发布设计派生的对外产品号。**稳定**：同一份设计永远得到同一个号，
 * 所以重放不会生成两个号；用户也可以直接给一个自己的号覆盖它。
 */
export function productNumberFor(sourceHandoffId: string): string {
  const digest = createHash("sha256")
    .update(sourceHandoffId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `P-${digest}`;
}

export function prepareProductIdentityDraft(
  current: CurrentProductIdentity,
  sourceHandoffId: string,
  command: ProductIdentityDraftCommandV1,
): PreparedProductIdentityDraft {
  if (command.contractVersion !== "product-identity-draft.v1") {
    invalid("contractVersion");
  }
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedVersion = version(command.expectedVersion, "expectedVersion");
  if (expectedVersion !== current.version) {
    conflict("PRODUCT_IDENTITY_VERSION_CONFLICT");
  }
  const attributes = normalizeAttributes(command.attributes);
  const skus = normalizeSkus(command.skus);
  const productNumber = command.productNumber
    ? text(command.productNumber, "productNumber", 100)
    : productNumberFor(sourceHandoffId);

  const normalized = {
    expectedVersion,
    version: current.version + 1,
    productNumber,
    attributes,
    skus,
    idempotencyKey,
  };
  return {
    ...normalized,
    pendingFieldCodes: productIdentityPendingFieldCodes(),
    payloadHash: hash(normalized),
  };
}

export function prepareSellableSkuRelease(
  current: CurrentProductIdentity,
  command: SellableSkuReleaseCommandV1,
): PreparedSellableSkuRelease {
  if (command.contractVersion !== "sellable-sku-release.v1") {
    invalid("contractVersion");
  }
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedVersion = version(command.expectedVersion, "expectedVersion");
  if (expectedVersion !== current.version) {
    conflict("PRODUCT_IDENTITY_VERSION_CONFLICT");
  }

  // 发布是交给下游当依据的那一刻，所以这里才卡硬项。
  // 逐项列出差什么 —— 只说"还不能发布"等于让人自己猜。
  const missing: string[] = [];
  if (!current.productNumber) missing.push("productNumber");
  if (current.skuCount < 1) missing.push("skus");
  const attributes = current.attributes;
  if (!attributes?.categoryCode) missing.push("categoryCode");
  if (!attributes?.functionalName) missing.push("functionalName");
  if (!attributes?.countryOfOrigin) missing.push("countryOfOrigin");
  if (!attributes?.hsCode) missing.push("hsCode");
  if (!attributes || attributes.targetCountries.length === 0) {
    missing.push("targetCountries");
  }
  if (missing.length > 0) {
    invalid(`PRODUCT_IDENTITY_RELEASE_INCOMPLETE: ${missing.join(",")}`);
  }

  const normalized = {
    expectedVersion,
    version: current.version + 1,
    idempotencyKey,
  };
  return {
    ...normalized,
    pendingFieldCodes: productIdentityPendingFieldCodes(),
    payloadHash: hash(normalized),
  };
}

function normalizeAttributes(
  value: ProductAttributesV1 | undefined,
): ProductAttributesV1 {
  if (!value || typeof value !== "object") invalid("attributes");
  return {
    categoryCode: optionalText(value.categoryCode, "categoryCode", 100),
    brandName: optionalText(value.brandName, "brandName", 100),
    subBrandName: optionalText(value.subBrandName, "subBrandName", 100),
    modelNumber: optionalText(value.modelNumber, "modelNumber", 100),
    functionalName: optionalText(value.functionalName, "functionalName", 200),
    countryOfOrigin: countryCode(value.countryOfOrigin, "countryOfOrigin"),
    hsCode: hsCode(value.hsCode),
    targetCountries: countryCodes(value.targetCountries, "targetCountries"),
    certifications: stringList(value.certifications, "certifications", 100),
    temperature: value.temperature ?? null,
    dangerousGoods: value.dangerousGoods ?? null,
    orderConditions: value.orderConditions ?? {
      leadTimeDays: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      orderSizingFactor: null,
      orderMultiple: null,
    },
  };
}

function normalizeSkus(
  values: ProductIdentityDraftCommandV1["skus"] | undefined,
): PreparedSkuDraft[] {
  if (!Array.isArray(values) || values.length === 0) invalid("skus");
  if (values.length > 200) invalid("skus");
  const seen = new Set<string>();
  return values.map((sku) => {
    const skuCode = text(sku.skuCode, "skus.skuCode", 100);
    if (seen.has(skuCode)) {
      // 同一产品下编号必须唯一，否则下游按编号找 SKU 会找到两个。
      invalid("skus.skuCode（同一产品下不能重复）");
    }
    seen.add(skuCode);
    const skuId = sku.skuId ? uuid(sku.skuId, "skus.skuId") : null;
    if (!sku.attributes || typeof sku.attributes !== "object") {
      invalid("skus.attributes");
    }
    return { skuId, skuCode, attributes: sku.attributes };
  });
}

function countryCode(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = text(value, field, 2);
  if (!/^[A-Z]{2}$/.test(normalized)) invalid(field);
  return normalized;
}

function countryCodes(
  values: readonly string[] | undefined,
  field: string,
): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) invalid(field);
  const normalized = values
    .map((value) => countryCode(value, field)!)
    .filter(Boolean);
  return [...new Set(normalized)];
}

function hsCode(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = text(value, "hsCode", 10);
  if (!/^[0-9]{6,10}$/.test(normalized)) invalid("hsCode");
  return normalized;
}

function stringList(
  values: readonly string[] | undefined,
  field: string,
  maxLength: number,
): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) invalid(field);
  return [...new Set(values.map((value) => text(value, field, maxLength)))];
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

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid(field);
  return value;
}

function uuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) invalid(field);
  return value.toLowerCase();
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function invalid(field: string): never {
  throw new ProductIdentityValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new ProductIdentityConflictError(code);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
