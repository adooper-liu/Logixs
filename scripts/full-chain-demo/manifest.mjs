import {
  canonicalStringify,
  manifestHashProjection,
  sha256Hex,
  sortedEntries,
} from "./canonical-json.mjs";

export const TARGET_TENANT = "demo-real-sample-20260921";
function domain(value = {}) {
  const entries = sortedEntries(value.entries ?? []);
  return {
    entries,
    count: entries.length,
    candidateCount: value.candidateCount ?? entries.length,
    hash: sha256Hex(entries),
  };
}
export function composePurgeManifest({
  catalog,
  postgres = {},
  minio = {},
  temporal = {},
  context = {},
}) {
  if (catalog.targetTenant !== TARGET_TENANT)
    throw new Error("DEMO_MAINTENANCE_TENANT_DENIED");
  const blockers = [
    ...new Set([
      ...(postgres.blockers ?? []),
      ...(minio.blockers ?? []),
      ...(temporal.blockers ?? []),
    ]),
  ].sort();
  const manifest = {
    manifestVersion: "full-chain-demo-purge-manifest.v1",
    targetTenant: TARGET_TENANT,
    catalogVersion: catalog.catalogVersion,
    catalogHash: context.catalogHash ?? sha256Hex(catalog),
    schemaFingerprint: context.schemaFingerprint ?? "not-provided",
    migrationFingerprint: context.migrationFingerprint ?? "not-provided",
    postgres: domain(postgres),
    minio: domain(minio),
    temporal: domain({
      ...temporal,
      candidateCount: temporal.targetCount ?? temporal.candidateCount,
    }),
    blockers: domain({ entries: blockers.map((code) => ({ code })) }),
    deletable: false,
    allowedProof: ["demo ownership inventory", "purge dry-run input"],
    prohibitedProof: [
      "deletion authorization",
      "backup complete",
      "demo switched",
    ],
    generatedAt: context.generatedAt ?? new Date().toISOString(),
    operator: context.operator ?? "full-chain-demo",
    traceId: context.traceId ?? "not-provided",
  };
  return {
    ...manifest,
    manifestHash: sha256Hex(manifestHashProjection(manifest)),
  };
}
export function compareManifestState(expected, current) {
  const differences = [];
  for (const domain of [
    "catalogHash",
    "schemaFingerprint",
    "migrationFingerprint",
    "postgres",
    "minio",
    "temporal",
    "blockers",
  ]) {
    if (
      canonicalStringify(expected[domain]) !==
      canonicalStringify(current[domain])
    )
      differences.push({ code: `MANIFEST_${domain.toUpperCase()}_CHANGED` });
  }
  if (expected.manifestHash !== current.manifestHash)
    differences.push({ code: "MANIFEST_HASH_CHANGED" });
  return differences;
}
