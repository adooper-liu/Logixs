import { sha256Hex } from "./canonical-json.mjs";

const scenario = {
  label: "constructed-chain",
  allowedUse: "local_demo_rehearsal",
};
const value = (row, field) => row?.valuesByHeader?.[field] ?? null;

export function buildProvenanceIndexes(scan, policy) {
  const constructed = new Map();
  const derivations = new Map();
  const pending = new Set();
  const provenanceConflicts = new Set();
  for (const row of scan.sheets.find(
    (sheet) => sheet.name === "26_样本构建清单",
  )?.rows ?? []) {
    const sheet = value(row, "工作表");
    const identity = value(row, "行 identity") ?? value(row, "行标识");
    const field = value(row, "字段");
    if (sheet && identity && field) {
      const key = `${sheet}|${identity}|${field}`;
      if (constructed.has(key)) provenanceConflicts.add(`constructed:${key}`);
      else constructed.set(key, { ...scenario });
    }
  }
  for (const row of scan.sheets.find((sheet) => sheet.name === "25_推导依据")
    ?.rows ?? []) {
    const id = value(row, "推导依据ID") ?? value(row, "推导 ID");
    const nature = value(row, "性质");
    if (id && nature) {
      if (derivations.has(id)) provenanceConflicts.add(`derivation:${id}`);
      else
        derivations.set(id, {
          code: id,
          version: value(row, "版本") ?? "v1",
          kind: nature,
        });
    }
  }
  for (const row of scan.sheets.find((sheet) => sheet.name === "23_待确认")
    ?.rows ?? []) {
    const ref = value(row, "引用") ?? value(row, "字段");
    if (ref) pending.add(ref);
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
    field,
    declaredClass,
    derivationRef,
    sourceRef,
  } = input;
  const key = `${sheet}|${identity}|${field}`;
  if (
    indexes?.provenanceConflicts?.has(`constructed:${key}`) ||
    (derivationRef &&
      indexes?.provenanceConflicts?.has(`derivation:${derivationRef}`))
  )
    return { kind: "gap", code: "PROVENANCE_CONFLICT" };
  if (
    indexes?.pending?.has(key) ||
    declaredClass === "P" ||
    !declaredClass ||
    !["R", "D", "S"].includes(declaredClass)
  )
    return { kind: "gap", code: "PROVENANCE_PENDING" };
  const isConstructed = indexes?.constructed?.has(key);
  if (isConstructed && declaredClass !== "S")
    return { kind: "gap", code: "PROVENANCE_CONFLICT" };
  if (
    isConstructed &&
    !indexes?.constructionOverrides?.has(`${sheet}|${field}`)
  )
    return { kind: "gap", code: "CONSTRUCTION_OVERRIDE_UNAUTHORIZED" };
  if (declaredClass === "S" && !isConstructed)
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
  if (declaredClass === "S") return { evidenceClass: "S", scenario };
  if (declaredClass === "R") {
    if (!sourceRef) return { kind: "gap", code: "SOURCE_REFERENCE_REQUIRED" };
    if (
      indexes?.approvedDirectSources &&
      !indexes.approvedDirectSources.has(`${sheet}|${field}`)
    )
      return { kind: "gap", code: "SOURCE_REFERENCE_UNAUTHORIZED" };
    return { evidenceClass: "R" };
  }
  return { kind: "gap", code: "PROVENANCE_UNCLASSIFIED" };
}

export function headerFingerprint(headers) {
  return sha256Hex(JSON.stringify(headers));
}
