import { canonicalStringify, sha256Hex } from "./canonical-json.mjs";
import { classifyMappedValue } from "./classification.mjs";
import { runPackageChecks } from "./reconcile.mjs";

const text = (row, field) => row?.valuesByHeader?.[field] ?? null;
const rank = { R: 1, D: 2, S: 3 };
const recordRef = (record) => `${record.recordType}:${record.businessKey}`;

function mappingConsumesField(policy, sheet, field) {
  return policy.pilotMappings.some(
    (mapping) =>
      mapping.sheet === sheet && Object.values(mapping.payload).includes(field),
  );
}

function isPilotProvenanceConflict(conflict, indexes, policy) {
  const [kind, ...parts] = conflict.split(":");
  if (kind === "constructed" || kind === "derivation-binding-duplicate") {
    const [sheet, ...fieldParts] = parts.join(":").split("|");
    return mappingConsumesField(policy, sheet, fieldParts.at(-1));
  }
  if (kind === "derivation") {
    const id = parts.join(":");
    for (const [binding, ids] of indexes.derivationBindings ?? []) {
      if (!ids.has(id)) continue;
      const [sheet, ...fieldParts] = binding.split("|");
      if (mappingConsumesField(policy, sheet, fieldParts.join("|")))
        return true;
    }
  }
  return false;
}

function stableValue(value) {
  return Array.isArray(value) ? value.join("|") : String(value ?? "").trim();
}

export function normalizeHouseBillReference(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .trim();
  if (!normalized) throw new Error("CODE_INVALID");
  return normalized;
}

function normalizeIdentityValue(field, raw) {
  if (field === "分提单") {
    if (raw === null || raw === undefined || !String(raw).trim()) return "";
    return normalizeHouseBillReference(raw);
  }
  return stableValue(raw);
}

function normalizePayloadField(output, raw, row, fieldPolicy) {
  if (raw === null || raw === "") return null;
  if (output === "houseBillNo") return normalizeHouseBillReference(raw);
  if (
    [
      "planNo",
      "bookingNo",
      "cargoReadyNo",
      "containerNo",
      "sku",
      "houseBillNo",
      "invoiceNo",
      "declarationNo",
      "masterBillNo",
      "voyageNo",
    ].includes(output)
  )
    return normalizeCode(raw);
  if (
    output === "amount" ||
    ["quantity", "grossWeight", "volume"].includes(output)
  )
    return normalizeDecimal(raw);
  if (output.toLowerCase().includes("date") || output.endsWith("At"))
    return normalizeDate(raw, {
      precision: fieldPolicy?.normalization?.precision ?? text(row, "日期精度"),
      timezone: fieldPolicy?.normalization?.timezone ?? text(row, "时区"),
      formats: fieldPolicy?.normalization?.formats,
    });
  if (output.endsWith("Refs")) return normalizeList(raw);
  return raw;
}

export function normalizeDate(value, { precision, timezone, formats } = {}) {
  if (!value) return null;
  if (!precision || (precision !== "date" && precision !== "datetime"))
    throw new Error("DATE_PRECISION_REQUIRED");
  if (precision === "datetime" && !timezone)
    throw new Error("TIMEZONE_REQUIRED");
  const isExcelDate = value && typeof value === "object" && "rawText" in value;
  const rawValue = isExcelDate ? value.rawText : value;
  const textValue = String(rawValue).trim();
  const dateText =
    precision === "date" && isExcelDate ? textValue.slice(0, 10) : textValue;
  if (precision === "date" && formats?.length) {
    return normalizeDateOnlyFormat(dateText, formats);
  }
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateText);
  if (precision === "date") {
    if (!dateMatch) throw new Error("DATE_PRECISION_INVALID");
    assertCalendarDate(dateMatch);
    return dateText;
  }
  const parsed = parseExplicitTimezoneDateTime(textValue, timezone);
  if (Number.isNaN(parsed.valueOf())) throw new Error("DATE_INVALID");
  return parsed.toISOString();
}

function normalizeDateOnlyFormat(value, formats) {
  for (const format of formats) {
    if (format === "iso-date") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
      if (match) {
        assertCalendarDate(match);
        return value;
      }
    }
    if (format === "m/d/yyyy") {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(value);
      if (match) {
        const [, month, day, year] = match;
        const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        assertCalendarDate(["", year, iso.slice(5, 7), iso.slice(8, 10)]);
        return iso;
      }
    }
    if (format === "datetime-seconds") {
      const match =
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/u.exec(value);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        assertCalendarDate(["", year, month, day]);
        if (Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59)
          return `${year}-${month}-${day}`;
      }
    }
  }
  throw new Error("DATE_PRECISION_INVALID");
}

function assertCalendarDate(match) {
  const [, year, month, day] = match;
  const candidate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (
    candidate.getUTCFullYear() !== Number(year) ||
    candidate.getUTCMonth() !== Number(month) - 1 ||
    candidate.getUTCDate() !== Number(day)
  )
    throw new Error("DATE_INVALID");
}

function parseExplicitTimezoneDateTime(value, timezone) {
  const explicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value);
  if (explicitOffset) {
    validateTimezone(timezone);
    const datePart = /^(\d{4}-\d{2}-\d{2})[T ]/u.exec(value)?.[1];
    if (!datePart) throw new Error("DATE_INVALID");
    assertCalendarDate(["", ...datePart.split("-")]);
    return new Date(value);
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/u.exec(
      value,
    );
  if (!match) throw new Error("DATE_INVALID");
  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  assertCalendarDate(["", year, month, day]);
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59)
    throw new Error("DATE_INVALID");
  const milliseconds = Number(fraction.padEnd(3, "0"));
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds,
  );
  const offsetMinutes = timezoneOffsetMinutes(timezone, wallClock);
  return new Date(wallClock - offsetMinutes * 60_000);
}

function validateTimezone(timezone) {
  const offset = /^([+-])(\d{2}):?(\d{2})$/u.exec(String(timezone));
  if (offset) {
    const hours = Number(offset[2]);
    const minutes = Number(offset[3]);
    if (hours > 23 || minutes > 59) throw new Error("TIMEZONE_INVALID");
    return;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new Error("TIMEZONE_INVALID");
  }
}

function timezoneOffsetMinutes(timezone, wallClock) {
  const offset = /^([+-])(\d{2}):?(\d{2})$/u.exec(String(timezone));
  if (offset) {
    const minutes = Number(offset[2]) * 60 + Number(offset[3]);
    return offset[1] === "+" ? minutes : -minutes;
  }
  validateTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(wallClock));
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  const rendered = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((rendered - wallClock) / 60_000);
}

export function normalizeDecimal(
  value,
  { scale = 2, allowNegative = false } = {},
) {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isInteger(scale) || scale < 0) throw new Error("DECIMAL_INVALID");
  const match = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/u.exec(
    String(value).trim(),
  );
  if (!match) throw new Error("DECIMAL_INVALID");
  const [, sign, groupedInteger, fraction = ""] = match;
  if (sign === "-" && !allowNegative) throw new Error("DECIMAL_INVALID");
  const integer = groupedInteger.replaceAll(",", "").replace(/^0+(?=\d)/u, "");
  let scaled = `${integer}${fraction.slice(0, scale).padEnd(scale, "0")}`;
  if (fraction.length > scale && fraction[scale] >= "5") {
    const digits = scaled.split("");
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      if (digits[index] === "9") digits[index] = "0";
      else {
        digits[index] = String.fromCharCode(digits[index].charCodeAt(0) + 1);
        break;
      }
    }
    if (digits[0] === "0") digits.unshift("1");
    scaled = digits.join("");
  }
  const integerEnd = scaled.length - scale;
  const output =
    scale === 0
      ? scaled
      : `${scaled.slice(0, integerEnd)}.${scaled.slice(integerEnd)}`;
  return sign === "-" && output !== "0" && !/^0+\.0+$/u.test(output)
    ? `-${output}`
    : output;
}

export function normalizeList(value, { separator = /\s*[+,/]\s*/u } = {}) {
  return value
    ? String(value)
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
export function normalizeCode(value, { pattern = /^[^\s]+$/u } = {}) {
  if (!value || !pattern.test(String(value))) throw new Error("CODE_INVALID");
  return String(value).trim();
}

function classifyRow(row, mapping, indexes, policy) {
  const declaredClass = text(row, "证据等级") ?? text(row, "证据级别");
  if (!declaredClass && policy?.policyVersion !== "full-chain-policy.v0.5")
    return {
      gap: {
        code: "PROVENANCE_PENDING",
        status: "blocking",
        reason: "mapped value lacks field-level evidence policy",
      },
    };
  const identity = mapping.identity
    .map((field) => stableValue(text(row, field)))
    .join("|");
  let strongest = "R";
  let derivation = null;
  let scenario = null;
  for (const [output, input] of Object.entries(mapping.payload)) {
    const result = classifyMappedValue({
      indexes,
      sheet: mapping.sheet,
      identity,
      rowKey: row.rowKey,
      field: input,
      fieldPolicy: mapping.fieldPolicy?.[output],
      rawValue: text(row, input),
      declaredClass,
      derivationRef: text(row, "推导依据ID") ?? text(row, "推导 ID"),
      sourceRef: `${mapping.sheet}#${row.workbookRow}`,
    });
    if (result.kind === "gap")
      return {
        gap: {
          code: result.code,
          status: "blocking",
          reason: "mapped value lacks approved evidence",
        },
      };
    if (rank[result.evidenceClass] > rank[strongest])
      strongest = result.evidenceClass;
    derivation ??= result.derivation ?? null;
    scenario ??= result.scenario ?? null;
  }
  return { evidenceClass: strongest, derivation, scenario };
}

export function compilePilotRecords({
  scan,
  policy,
  indexes = {
    constructed: new Map(),
    derivations: new Map(),
    pending: new Set(),
  },
}) {
  const records = [];
  const lineage = [];
  const gaps = [];
  for (const conflict of indexes.provenanceConflicts ?? [])
    if (isPilotProvenanceConflict(conflict, indexes, policy))
      gaps.push({
        code: "PROVENANCE_CONFLICT",
        status: "blocking",
        reason: "duplicate provenance index",
      });
  for (const mapping of policy.pilotMappings) {
    const sheet = scan.sheets.find(
      (candidate) => candidate.name === mapping.sheet,
    );
    if (!sheet) {
      gaps.push({
        code: "SHEET_MISSING",
        status: "blocking",
        reason: "pilot source sheet is absent",
      });
      continue;
    }
    for (const row of sheet.rows) {
      if (mapping.sheet === "11a_出口报关" && text(row, "层级") === "品名行") {
        gaps.push({
          code: "CUSTOMS_LINE_IDENTITY_UNSUPPORTED",
          status: "informational",
          reason: "customs item rows are evidence-only in Brief 1",
        });
        continue;
      }
      if (
        mapping.rowFilter &&
        Object.entries(mapping.rowFilter).some(
          ([field, expected]) => text(row, field) !== expected,
        )
      )
        continue;
      const identityParts = mapping.identity.map((field) =>
        normalizeIdentityValue(field, text(row, field)),
      );
      if (identityParts.some((part) => !part)) {
        gaps.push({
          code: "BUSINESS_KEY_MISSING",
          status: "blocking",
          reason: "pilot row has no stable identity",
        });
        continue;
      }
      const businessKey = identityParts.join("|");
      let evidence;
      try {
        evidence = classifyRow(row, mapping, indexes, policy);
      } catch (error) {
        gaps.push({
          code: error.message,
          status: "blocking",
          recordRef: `${mapping.recordType}:${businessKey}`,
          reason: "mapped value failed closed validation",
        });
        continue;
      }
      if (evidence.gap) {
        gaps.push({
          ...evidence.gap,
          recordRef: `${mapping.recordType}:${businessKey}`,
        });
        continue;
      }
      const payload = {};
      const sourceValues = {};
      let normalizationError = null;
      for (const [output, input] of Object.entries(mapping.payload)) {
        const raw = text(row, input);
        sourceValues[output] = raw;
        try {
          const normalized = normalizePayloadField(
            output,
            raw,
            row,
            mapping.fieldPolicy?.[output],
          );
          if (normalized !== null) payload[output] = normalized;
        } catch (error) {
          normalizationError = error;
        }
      }
      if (normalizationError) {
        gaps.push({
          code: normalizationError.message,
          status: "blocking",
          recordRef: `${mapping.recordType}:${businessKey}`,
          reason: "mapped value failed normalization",
        });
        continue;
      }
      if (payload.amount !== undefined && !payload.currency) {
        gaps.push({
          code: "CURRENCY_REQUIRED",
          status: "blocking",
          recordRef: `${mapping.recordType}:${businessKey}`,
          reason: "amount requires currency",
        });
        continue;
      }
      const record = {
        recordType: mapping.recordType,
        recordVersion: "v1",
        businessKey,
        sampleLine: text(row, "样本线") ?? "A_CA",
        evidenceClass: evidence.evidenceClass,
        source: {
          sheet: mapping.sheet,
          row: row.workbookRow,
          sourceRef: `${mapping.sheet}#${row.workbookRow}`,
          originalValueHash: sha256Hex(canonicalStringify(sourceValues)),
        },
        derivation: evidence.evidenceClass === "D" ? evidence.derivation : null,
        scenario: evidence.evidenceClass === "S" ? evidence.scenario : null,
        payload,
      };
      records.push(record);
      lineage.push({
        recordRef: recordRef(record),
        sourceRef: record.source.sourceRef,
        payloadFields: Object.keys(payload).sort(),
      });
    }
  }
  const checks = runPackageChecks({ records, scan, policy });
  return {
    records,
    lineage,
    gaps,
    checks,
    publishable:
      gaps.every((item) => item.status !== "blocking") &&
      checks.every((item) => item.status !== "fail"),
  };
}
