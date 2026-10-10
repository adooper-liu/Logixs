import { sha256Hex } from "./canonical-json.mjs";

const scenario = {
  label: "constructed-chain",
  allowedUse: "local_demo_rehearsal",
};
const value = (row, field) => row?.valuesByHeader?.[field] ?? null;

function resolveDerivationSupport(rawValue, policy) {
  if (!rawValue) return [];
  const normalized = String(rawValue)
    .normalize("NFC")
    .replace(/\s*\/\s*/gu, "/")
    .trim();
  const matches = [];
  for (const mapping of policy?.pilotMappings ?? []) {
    for (const field of Object.values(mapping.payload ?? {})) {
      if (`${mapping.sheet}/${field}` === normalized)
        matches.push({ sheet: mapping.sheet, field });
    }
  }
  return matches;
}

function provenanceToken(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim();
}

export function buildProvenanceIndexes(scan, policy) {
  const constructed = new Map();
  const derivations = new Map();
  const derivationBindings = new Map();
  const pending = new Set();
  const provenanceConflicts = new Set();
  for (const row of scan.sheets.find(
    (sheet) => sheet.name === "26_样本构建清单",
  )?.rows ?? []) {
    const sheet = value(row, "工作表");
    const identity =
      value(row, "行") ?? value(row, "行 identity") ?? value(row, "行标识");
    const field = value(row, "字段");
    if (sheet && identity && field) {
      const key = `${sheet}|${identity}|${field}`;
      const rawToken = provenanceToken(value(row, "值"));
      const basisToken = provenanceToken(value(row, "构建依据"));
      const candidates = constructed.get(key) ?? new Map();
      const candidate = candidates.get(rawToken) ?? {
        ...scenario,
        value: value(row, "值"),
        basis: value(row, "构建依据"),
        bases: new Set(),
      };
      candidate.bases.add(basisToken);
      candidates.set(rawToken, candidate);
      constructed.set(key, candidates);
      if (candidate.bases.size > 1)
        provenanceConflicts.add(`constructed:${key}`);
    }
  }
  for (const row of scan.sheets.find((sheet) => sheet.name === "25_推导依据")
    ?.rows ?? []) {
    const id =
      value(row, "编号") ?? value(row, "推导依据ID") ?? value(row, "推导 ID");
    const nature = value(row, "性质");
    if (id && nature) {
      if (derivations.has(id)) provenanceConflicts.add(`derivation:${id}`);
      else
        derivations.set(id, {
          code: id,
          version: value(row, "版本") ?? "v1",
          kind: nature,
        });
      const supportText = value(row, "支撑的样本表/字段");
      const supportMatches = supportText
        ? resolveDerivationSupport(supportText, policy)
        : (() => {
            const supportedSheet = value(row, "支撑的样本表");
            const supportedField = value(row, "字段");
            return supportedSheet && supportedField
              ? [{ sheet: supportedSheet, field: supportedField }]
              : [];
          })();
      if (supportMatches.length === 1) {
        const [{ sheet: supportedSheet, field: supportedField }] =
          supportMatches;
        const bindingKey = `${supportedSheet}|${supportedField}`;
        const bindings = derivationBindings.get(bindingKey) ?? new Set();
        if (bindings.has(id))
          provenanceConflicts.add(`derivation-binding-duplicate:${bindingKey}`);
        bindings.add(id);
        derivationBindings.set(bindingKey, bindings);
      }
    }
  }
  for (const row of scan.sheets.find((sheet) => sheet.name === "23_待确认")
    ?.rows ?? []) {
    const ref = value(row, "引用") ?? value(row, "字段");
    if (ref) pending.add(ref);
    const pendingSheet = value(row, "工作表");
    const pendingRow = value(row, "行");
    const pendingField = value(row, "字段");
    if (pendingSheet && pendingRow && pendingField)
      pending.add(`${pendingSheet}|${pendingRow}|${pendingField}`);
  }
  const approvedDirectSources = new Set();
  const constructionOverrides = new Set();
  for (const mapping of policy?.pilotMappings ?? []) {
    for (const [field, fieldPolicy] of Object.entries(
      mapping.fieldPolicy ?? {},
    )) {
      if (fieldPolicy.directSource)
        approvedDirectSources.add(`${mapping.sheet}|${field}`);
      if (fieldPolicy.constructionOverrideAllowed)
        constructionOverrides.add(`${mapping.sheet}|${field}`);
    }
  }
  return {
    constructed,
    derivations,
    derivationBindings,
    pending,
    approvedDirectSources,
    constructionOverrides,
    provenanceConflicts,
    policy,
  };
}

export function classifyMappedValue(input) {
  const {
    indexes,
    sheet,
    identity,
    rowKey,
    field,
    fieldPolicy,
    rawValue,
    declaredClass,
    derivationRef,
    sourceRef,
  } = input;
  const key = `${sheet}|${rowKey ?? identity}|${field}`;
  if (
    indexes?.provenanceConflicts?.has(`constructed:${key}`) ||
    (derivationRef &&
      indexes?.provenanceConflicts?.has(`derivation:${derivationRef}`))
  )
    return { kind: "gap", code: "PROVENANCE_CONFLICT" };
  if (indexes?.pending?.has(key) || declaredClass === "P")
    return { kind: "gap", code: "PROVENANCE_PENDING" };
  const constructionIndex = indexes?.constructed?.get(key);
  const construction =
    constructionIndex instanceof Map
      ? constructionIndex.get(
          rawValue === null || rawValue === undefined
            ? [...constructionIndex.keys()][0]
            : provenanceToken(rawValue),
        )
      : constructionIndex;
  const isConstructed = Boolean(construction);
  if (isConstructed && construction.bases?.size > 1)
    return { kind: "gap", code: "PROVENANCE_CONFLICT" };
  if (
    isConstructed &&
    !(
      fieldPolicy?.constructionOverrideAllowed ??
      indexes?.constructionOverrides?.has(`${sheet}|${field}`)
    )
  )
    return { kind: "gap", code: "CONSTRUCTION_OVERRIDE_UNAUTHORIZED" };
  if (isConstructed) {
    if (declaredClass && declaredClass !== "S")
      return { kind: "gap", code: "PROVENANCE_CONFLICT" };
    return { evidenceClass: "S", scenario };
  }
  if (declaredClass === "S")
    return { kind: "gap", code: "CONSTRUCTION_REQUIRED" };
  if (declaredClass === "D") {
    if (!derivationRef || !indexes?.derivations?.has(derivationRef))
      throw new Error("DERIVATION_REQUIRED");
    if (indexes.derivations.get(derivationRef).kind !== "推导")
      return { kind: "gap", code: "DERIVATION_NOT_APPROVED" };
    return {
      evidenceClass: "D",
      derivation: {
        code: derivationRef,
        version: indexes.derivations.get(derivationRef).version,
        inputRefs: sourceRef ? [sourceRef] : [],
      },
    };
  }
  const bindingKey = `${sheet}|${field}`;
  const bindingIds = indexes?.derivationBindings?.get(bindingKey);
  const derivationId =
    derivationRef ?? (bindingIds?.size === 1 ? [...bindingIds][0] : null);
  if (bindingIds?.size > 1)
    return { kind: "gap", code: "DERIVATION_AMBIGUOUS" };
  if (
    indexes?.provenanceConflicts?.has(
      `derivation-binding-duplicate:${bindingKey}`,
    )
  )
    return { kind: "gap", code: "PROVENANCE_CONFLICT" };
  if (derivationId) {
    if (!indexes?.derivations?.has(derivationId))
      return { kind: "gap", code: "DERIVATION_REQUIRED" };
    if (indexes.derivations.get(derivationId).kind !== "推导")
      return { kind: "gap", code: "DERIVATION_NOT_APPROVED" };
    return {
      evidenceClass: "D",
      derivation: {
        code: derivationId,
        version: indexes.derivations.get(derivationId).version,
        inputRefs: sourceRef ? [sourceRef] : [],
      },
    };
  }
  const directSource = fieldPolicy
    ? fieldPolicy.directSource
    : indexes?.approvedDirectSources
      ? indexes.approvedDirectSources.has(`${sheet}|${field}`)
      : declaredClass === "R";
  if (declaredClass === "R" || directSource) {
    if (!sourceRef) return { kind: "gap", code: "SOURCE_REFERENCE_REQUIRED" };
    if (!directSource)
      return { kind: "gap", code: "SOURCE_REFERENCE_UNAUTHORIZED" };
    return { evidenceClass: "R" };
  }
  return { kind: "gap", code: "PROVENANCE_UNCLASSIFIED" };
}

export function headerFingerprint(headers) {
  return sha256Hex(JSON.stringify(headers));
}
