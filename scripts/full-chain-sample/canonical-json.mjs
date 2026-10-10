import { createHash } from "node:crypto";

function normalize(value) {
  if (typeof value === "string")
    return value.normalize("NFC").replace(/\r\n?/gu, "\n");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

export function canonicalStringify(value) {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function packageHashProjection(artifacts) {
  return {
    source:
      artifacts.manifest?.source ?? artifacts.manifest?.sourceFileAlias ?? null,
    compilerVersion: artifacts.manifest?.compilerVersion ?? null,
    mappingVersion: artifacts.manifest?.mappingVersion ?? null,
    policyVersion: artifacts.manifest?.policyVersion ?? null,
    gitCommit: artifacts.manifest?.gitCommit ?? null,
    records: [...(artifacts.records ?? [])].sort((a, b) =>
      `${a.recordType}|${a.businessKey}`.localeCompare(
        `${b.recordType}|${b.businessKey}`,
      ),
    ),
    lineage: [...(artifacts.lineage ?? [])].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    ),
    gaps: [...(artifacts.gaps ?? [])].sort((a, b) =>
      `${a.code}|${a.recordRef ?? ""}`.localeCompare(
        `${b.code}|${b.recordRef ?? ""}`,
      ),
    ),
    checks: [...(artifacts.checks ?? [])].sort((a, b) =>
      `${a.code}|${a.recordRef ?? ""}`.localeCompare(
        `${b.code}|${b.recordRef ?? ""}`,
      ),
    ),
  };
}

export function packageHash(artifacts) {
  return sha256Hex(canonicalStringify(packageHashProjection(artifacts)));
}

export function canonicalText(value) {
  return `${canonicalStringify(value)}\n`;
}
