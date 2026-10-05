import type {
  ProductInitiativeUnitEconomicsDraftV1,
  ProductInitiativeUnitEconomicsPendingFieldCodeV1,
  ProductInitiativeUnitEconomicsRangeDraftV1,
  ProductInitiativeUnitEconomicsRangeSnapshotV1,
  ProductInitiativeUnitEconomicsScenarioSnapshotV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
} from "@logix/contracts";

export const UNIT_ECONOMICS_SCENARIOS = ["baseline", "conservative"] as const;

export const UNIT_ECONOMICS_AMOUNT_FIELDS = [
  "salePrice",
  "landedCost",
  "platformFee",
  "fulfillmentFee",
  "advertisingCost",
  "returnCost",
] as const;

type ScenarioCode = (typeof UNIT_ECONOMICS_SCENARIOS)[number];
type AmountField = (typeof UNIT_ECONOMICS_AMOUNT_FIELDS)[number];
type CurrencyResolution =
  "active" | "inactive" | "unknown" | "unavailable" | null;

export interface ProductInitiativeUnitEconomicsContext {
  marketCode: string | null;
  channelCode: string | null;
  currencyResolution: CurrencyResolution;
}

export interface PreparedProductInitiativeUnitEconomics {
  draft: ProductInitiativeUnitEconomicsDraftV1 | null;
  snapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  negativeConservativeReason: string | null;
  pendingFieldCodes: ProductInitiativeUnitEconomicsPendingFieldCodeV1[];
  evidenceRefs: string[];
}

export class ProductInitiativeUnitEconomicsValidationError extends Error {}

export function requestedUnitEconomicsCurrencyCode(
  draft: ProductInitiativeUnitEconomicsDraftV1 | undefined,
): string | null {
  if (draft === undefined) return null;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    invalid("unitEconomicsDraft");
  }
  if (draft.currencyCode === undefined || draft.currencyCode === null) {
    return null;
  }
  if (
    typeof draft.currencyCode !== "string" ||
    !/^[A-Z]{3}$/.test(draft.currencyCode)
  ) {
    invalid("unitEconomics.currencyCode");
  }
  return draft.currencyCode;
}

export function prepareProductInitiativeUnitEconomics(input: {
  draft: ProductInitiativeUnitEconomicsDraftV1 | undefined;
  negativeConservativeReason: string | undefined;
  context: ProductInitiativeUnitEconomicsContext;
}): PreparedProductInitiativeUnitEconomics {
  const negativeConservativeReason = optionalText(
    input.negativeConservativeReason,
    "negativeConservativeReason",
    2000,
  );
  const source = input.draft;
  const currencyCode = requestedUnitEconomicsCurrencyCode(source);
  const marketCode = optionalContextCode(input.context.marketCode);
  const channelCode = optionalContextCode(input.context.channelCode);

  if (source && Object.prototype.hasOwnProperty.call(source, "marketCode")) {
    invalid("unitEconomics.marketCode");
  }
  if (source?.channelCode !== undefined && source.channelCode !== null) {
    const requestedChannel = requiredText(
      source.channelCode,
      "unitEconomics.channelCode",
      100,
    );
    if (!channelCode || requestedChannel !== channelCode) {
      throw new ProductInitiativeUnitEconomicsValidationError(
        "PRODUCT_INITIATIVE_UNIT_ECONOMICS_CHANNEL_MISMATCH",
      );
    }
  }
  if (currencyCode && input.context.currencyResolution === "unknown") {
    throw new ProductInitiativeUnitEconomicsValidationError(
      `CURRENCY_UNKNOWN: ${currencyCode}`,
    );
  }
  if (currencyCode && input.context.currencyResolution === "inactive") {
    throw new ProductInitiativeUnitEconomicsValidationError(
      `CURRENCY_INACTIVE: ${currencyCode}`,
    );
  }
  if (currencyCode && input.context.currencyResolution === "unavailable") {
    throw new ProductInitiativeUnitEconomicsValidationError(
      "REFERENCE_CURRENCY_RELEASE_UNAVAILABLE",
    );
  }
  if (currencyCode && input.context.currencyResolution !== "active") {
    throw new ProductInitiativeUnitEconomicsValidationError(
      `CURRENCY_UNKNOWN: ${currencyCode}`,
    );
  }

  const pending: ProductInitiativeUnitEconomicsPendingFieldCodeV1[] = [];
  if (!marketCode) pending.push("unitEconomics.marketCode");
  if (!channelCode) pending.push("unitEconomics.channelCode");
  if (!currencyCode) pending.push("unitEconomics.currencyCode");

  const normalizedScenarios: NonNullable<
    ProductInitiativeUnitEconomicsDraftV1["scenarios"]
  > = {};
  const completeScenarios = {} as Record<
    ScenarioCode,
    ProductInitiativeUnitEconomicsScenarioSnapshotV1
  >;
  const evidenceRefs = new Set<string>();

  for (const scenarioCode of UNIT_ECONOMICS_SCENARIOS) {
    const sourceScenario = source?.scenarios?.[scenarioCode];
    const normalizedScenario: NonNullable<
      ProductInitiativeUnitEconomicsDraftV1["scenarios"]
    >[ScenarioCode] = {};
    const completeRanges = {} as Record<
      AmountField,
      ProductInitiativeUnitEconomicsRangeSnapshotV1
    >;
    let complete = true;

    for (const amountField of UNIT_ECONOMICS_AMOUNT_FIELDS) {
      const path = `unitEconomics.scenarios.${scenarioCode}.${amountField}`;
      const normalized = normalizeRange(sourceScenario?.[amountField], path);
      if (normalized.draft) normalizedScenario[amountField] = normalized.draft;
      pending.push(...normalized.pendingFieldCodes);
      normalized.evidenceRefs.forEach((ref) => evidenceRefs.add(ref));
      if (normalized.snapshot)
        completeRanges[amountField] = normalized.snapshot;
      else complete = false;
    }

    if (sourceScenario) normalizedScenarios[scenarioCode] = normalizedScenario;
    if (complete) {
      completeScenarios[scenarioCode] = {
        ...completeRanges,
        contribution: contributionFor(completeRanges),
      };
    }
  }

  const draft = source
    ? {
        ...(marketCode ? { marketCode } : {}),
        ...(channelCode ? { channelCode } : {}),
        ...(currencyCode ? { currencyCode } : {}),
        ...(source.scenarios ? { scenarios: normalizedScenarios } : {}),
      }
    : null;
  const snapshot =
    pending.length === 0 &&
    marketCode &&
    channelCode &&
    currencyCode &&
    completeScenarios.baseline &&
    completeScenarios.conservative
      ? {
          marketCode,
          channelCode,
          currencyCode,
          scenarios: completeScenarios,
        }
      : null;

  if (snapshot) {
    const conservativeIsNegative =
      parseScaled(snapshot.scenarios.conservative.contribution.min) < 0n;
    if (conservativeIsNegative && !negativeConservativeReason) {
      pending.push("negativeConservativeReason");
    }
    if (!conservativeIsNegative && negativeConservativeReason) {
      invalid("negativeConservativeReason");
    }
  } else if (negativeConservativeReason) {
    invalid("negativeConservativeReason");
  }

  return {
    draft,
    snapshot,
    negativeConservativeReason,
    pendingFieldCodes: pending,
    evidenceRefs: [...evidenceRefs].sort(),
  };
}

function normalizeRange(
  source: ProductInitiativeUnitEconomicsRangeDraftV1 | undefined,
  path: string,
): {
  draft: ProductInitiativeUnitEconomicsRangeDraftV1 | null;
  snapshot: ProductInitiativeUnitEconomicsRangeSnapshotV1 | null;
  pendingFieldCodes: ProductInitiativeUnitEconomicsPendingFieldCodeV1[];
  evidenceRefs: string[];
} {
  const pending: ProductInitiativeUnitEconomicsPendingFieldCodeV1[] = [];
  if (source !== undefined && (!source || typeof source !== "object")) {
    invalid(path);
  }
  const min = normalizeOptionalAmount(source?.min, `${path}.min`);
  const max = normalizeOptionalAmount(source?.max, `${path}.max`);
  const basis = source?.basis;
  if (basis !== undefined && basis !== "evidence" && basis !== "assumption") {
    invalid(`${path}.basis`);
  }
  const evidenceRefs = normalizeEvidenceRefs(
    source?.evidenceRefs,
    `${path}.evidenceRefs`,
  );
  if (basis === "assumption" && evidenceRefs.length > 0) {
    invalid(`${path}.evidenceRefs`);
  }
  if (min !== null && max !== null && parseScaled(min) > parseScaled(max)) {
    invalid(path);
  }

  if (min === null) pending.push(`${path}.min` as never);
  if (max === null) pending.push(`${path}.max` as never);
  if (!basis) pending.push(`${path}.basis` as never);
  if (
    (!basis && source?.evidenceRefs === undefined) ||
    (basis === "evidence" && evidenceRefs.length === 0)
  ) {
    pending.push(`${path}.evidenceRefs` as never);
  }

  const draft = source
    ? {
        ...(min !== null ? { min } : {}),
        ...(max !== null ? { max } : {}),
        ...(basis ? { basis } : {}),
        ...(basis === "assumption" || source.evidenceRefs !== undefined
          ? { evidenceRefs }
          : {}),
      }
    : null;
  const snapshot =
    min !== null &&
    max !== null &&
    basis &&
    (basis === "assumption" || evidenceRefs.length > 0)
      ? { min, max, basis, evidenceRefs }
      : null;
  return { draft, snapshot, pendingFieldCodes: pending, evidenceRefs };
}

function contributionFor(
  ranges: Record<AmountField, ProductInitiativeUnitEconomicsRangeSnapshotV1>,
): { min: string; max: string } {
  const costFields = UNIT_ECONOMICS_AMOUNT_FIELDS.filter(
    (field): field is Exclude<AmountField, "salePrice"> =>
      field !== "salePrice",
  );
  const minimum =
    parseScaled(ranges.salePrice.min) -
    costFields.reduce((sum, field) => sum + parseScaled(ranges[field].max), 0n);
  const maximum =
    parseScaled(ranges.salePrice.max) -
    costFields.reduce((sum, field) => sum + parseScaled(ranges[field].min), 0n);
  return { min: formatScaled(minimum), max: formatScaled(maximum) };
}

function normalizeOptionalAmount(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalid(field);
  if (!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/.test(value)) {
    invalid(field);
  }
  return formatScaled(parseScaled(value));
}

function parseScaled(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const scaled = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
  return negative ? -scaled : scaled;
}

function formatScaled(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 10_000n;
  const fraction = (absolute % 10_000n)
    .toString()
    .padStart(4, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function normalizeEvidenceRefs(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) invalid(field);
  const normalized = value.map((item) => {
    if (typeof item !== "string" || !UUID_PATTERN.test(item)) invalid(field);
    return item.toLowerCase();
  });
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) invalid(field);
  return unique;
}

function optionalContextCode(value: string | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, field, maxLength);
}

function invalid(field: string): never {
  throw new ProductInitiativeUnitEconomicsValidationError(
    `VALIDATION_FORMAT: ${field}`,
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
