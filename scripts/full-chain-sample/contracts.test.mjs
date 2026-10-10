import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalStringify,
  packageHashProjection,
} from "./canonical-json.mjs";
import {
  validatePackageArtifacts,
  validateSourceManifest,
} from "./contracts.mjs";
import { buildPackageArtifacts } from "./package-writer.mjs";

const sourceManifest = {
  manifestVersion: "full-chain-source-manifest.v1",
  sourceAlias: "sample-fixture-v1",
  sha256: "a".repeat(64),
  sizeBytes: 1024,
  workbookVersion: "fixture-v1",
  authorizedUse: "local_demo_rehearsal",
};
const record = {
  recordType: "shipment_plan",
  recordVersion: "v1",
  businessKey: "PLAN-DEMO-001",
  sampleLine: "A_CA",
  evidenceClass: "R",
  source: {
    sheet: "09_出运计划",
    row: 7,
    sourceRef: "sheet:09_出运计划#7",
    originalValueHash: "b".repeat(64),
  },
  derivation: null,
  scenario: null,
  payload: { planNo: "PLAN-DEMO-001" },
};

test("source manifest rejects paths and unknown authorization", () => {
  assert.doesNotThrow(() => validateSourceManifest(sourceManifest));
  assert.throws(
    () =>
      validateSourceManifest({
        ...sourceManifest,
        absolutePath: "C:/private/sample.xlsx",
      }),
    /SOURCE_MANIFEST_INVALID/,
  );
  assert.throws(
    () =>
      validateSourceManifest({
        ...sourceManifest,
        authorizedUse: "production",
      }),
    /SOURCE_MANIFEST_INVALID/,
  );
});

test("package validation rejects P and incomplete D/S records", () => {
  const packageFor = (records) =>
    buildPackageArtifacts(
      { records, lineage: [], gaps: [], checks: [], publishable: true },
      {
        sourceManifest,
        sheetCount: 1,
        policy: { mappingVersion: "mapping-v1", policyVersion: "policy-v1" },
        compiledAt: "2026-01-01T00:00:00.000Z",
      },
    );
  assert.throws(
    () =>
      validatePackageArtifacts(packageFor([{ ...record, evidenceClass: "P" }])),
    /PACKAGE_RECORD_INVALID/,
  );
  assert.throws(
    () =>
      validatePackageArtifacts(
        packageFor([{ ...record, evidenceClass: "D", derivation: null }]),
      ),
    /PACKAGE_RECORD_INVALID/,
  );
  assert.throws(
    () =>
      validatePackageArtifacts(
        packageFor([{ ...record, evidenceClass: "S", scenario: null }]),
      ),
    /PACKAGE_RECORD_INVALID/,
  );
});

test("package validation rejects payload fields outside the record mapping", () => {
  const artifacts = buildPackageArtifacts(
    {
      records: [
        { ...record, payload: { planNo: "PLAN-DEMO-001", forbidden: "x" } },
      ],
      lineage: [],
      gaps: [],
      checks: [],
      publishable: true,
    },
    {
      sourceManifest,
      sheetCount: 1,
      policy: { mappingVersion: "mapping-v1", policyVersion: "policy-v1" },
      compiledAt: "2026-01-01T00:00:00.000Z",
    },
  );
  assert.throws(
    () => validatePackageArtifacts(artifacts),
    /PACKAGE_RECORD_INVALID/,
  );
});

test("package validation rejects manifest count, hash, and package hash tampering", () => {
  const artifacts = buildPackageArtifacts(
    { records: [record], lineage: [], gaps: [], checks: [], publishable: true },
    {
      sourceManifest,
      sheetCount: 1,
      policy: { mappingVersion: "mapping-v1", policyVersion: "policy-v1" },
      compiledAt: "2026-01-01T00:00:00.000Z",
      gitCommit: "fixture-git-001",
    },
  );
  for (const mutate of [
    (manifest) => ({ ...manifest, recordCount: 99 }),
    (manifest) => ({ ...manifest, recordsHash: "a".repeat(64) }),
    (manifest) => ({ ...manifest, packageHash: "b".repeat(64) }),
  ]) {
    assert.throws(
      () =>
        validatePackageArtifacts({
          ...artifacts,
          manifest: mutate(artifacts.manifest),
        }),
      /PACKAGE_(MANIFEST|HASH)_INVALID/,
    );
  }
});

test("canonical JSON normalizes order and line endings", () => {
  assert.equal(
    canonicalStringify({ b: "x\r\ny", a: 1 }),
    canonicalStringify({ a: 1, b: "x\ny" }),
  );
});

test("canonical sorting is independent of locale for non-ASCII keys", async () => {
  const { compareCanonicalStrings } = await import("./canonical-json.mjs");
  const values = ["A|中", "A|阿", "A|a", "A|Z"];
  assert.deepEqual(
    values.slice().sort(compareCanonicalStrings),
    values
      .slice()
      .sort((left, right) =>
        Buffer.from(left, "utf8").compare(Buffer.from(right, "utf8")),
      ),
  );
});

test("volatile package receipt fields are excluded from hash projection", () => {
  const first = {
    manifest: { source: "fixture", compilerVersion: "v1" },
    records: [record],
    gaps: [],
    checks: [],
    compiledAt: "2026-01-01",
    operator: "one",
  };
  const second = { ...first, compiledAt: "2026-02-01", operator: "two" };
  assert.deepEqual(packageHashProjection(first), packageHashProjection(second));
});
