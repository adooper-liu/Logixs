import { sha256Hex } from "./canonical-json.mjs";
import { classifyMappedValue } from "./classification.mjs";
import { runPackageChecks } from "./reconcile.mjs";

const text = (row, field) => row?.valuesByHeader?.[field] ?? null;
const rank = { R: 1, D: 2, S: 3 };
const recordRef = (record) => `${record.recordType}:${record.businessKey}`;

function stableValue(value) {
  return Array.isArray(value) ? value.join("|") : String(value ?? "").trim();
}

function normalizePayloadField(output, raw, row) {
  if (raw === null || raw === "") return null;
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
      "vesselName",
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
      precision: text(row, "日期精度"),
      timezone: text(row, "时区"),
    });
  if (output.endsWith("Refs")) return normalizeList(raw);
  return raw;
}

export function normalizeDate(value, { precision, timezone } = {}) {
  if (!value) return null;
  if (!precision || (precision !== "date" && precision !== "datetime"))
    throw new Error("DATE_PRECISION_REQUIRED");
  if (precision === "datetime" && !timezone)
    throw new Error("TIMEZONE_REQUIRED");
  if (precision === "date" && /T|\d{2}:\d{2}/u.test(String(value)))
    throw new Error("DATE_PRECISION_INVALID");
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("DATE_INVALID");
  return precision === "date" ? String(value).slice(0, 10) : date.toISOString();
}

export function normalizeDecimal(
  value,
  { scale = 2, allowNegative = false } = {},
) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replaceAll(",", ""));
  if (!Number.isFinite(numeric) || (!allowNegative && numeric < 0))
    throw new Error("DECIMAL_INVALID");
  return numeric.toFixed(scale);
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

function classifyRow(row, mapping, indexes) {
  const declaredClass = text(row, "证据等级") ?? text(row, "证据级别");
  const identity = mapping.identity
    .map((field) => stableValue(text(row, field)))
    .join("|");
  let strongest = "R";
  let derivation = null;
  let scenario = null;
  for (const field of Object.keys(mapping.payload)) {
    const result = classifyMappedValue({
      indexes,
      sheet: mapping.sheet,
      identity,
      field,
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
          status: "blocking",
          reason: "customs item rows have no stable declaration-line identity",
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
        stableValue(text(row, field)),
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
        evidence = classifyRow(row, mapping, indexes);
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
      let normalizationError = null;
      for (const [output, input] of Object.entries(mapping.payload)) {
        const raw = text(row, input);
        try {
          const normalized = normalizePayloadField(output, raw, row);
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
          originalValueHash: sha256Hex(JSON.stringify(payload)),
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
      gaps.length === 0 && checks.every((item) => item.status !== "fail"),
  };
}
