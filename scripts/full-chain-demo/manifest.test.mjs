import assert from "node:assert/strict";
import test from "node:test";
import { canonicalStringify } from "./canonical-json.mjs";
import { composePurgeManifest, compareManifestState } from "./manifest.mjs";

const catalog = {
  catalogVersion: "full-chain-demo-ownership.v1",
  targetTenant: "demo-real-sample-20260921",
  models: {},
};
const context = {
  catalogHash: "a".repeat(64),
  schemaFingerprint: "schema-v1",
  migrationFingerprint: "migration-v1",
  generatedAt: "2026-10-11T00:00:00.000Z",
};

function compose(overrides = {}) {
  return composePurgeManifest({
    catalog,
    postgres: {
      entries: [{ model: "Reference", primaryKeyHash: "content-a" }],
      candidateCount: 0,
    },
    minio: { entries: [{ key: "controlled-key", checksum: "checksum-a" }] },
    temporal: { entries: [{ type: "workflow", state: "running" }] },
    context,
    ...overrides,
  });
}

test("manifest hash ignores domain entry order and changes with state", () => {
  const one = composePurgeManifest({
    catalog,
    postgres: { entries: [{ id: 1 }, { id: 2 }] },
    context,
  });
  const two = composePurgeManifest({
    catalog,
    postgres: { entries: [{ id: 2 }, { id: 1 }] },
    context,
  });
  assert.equal(one.manifestHash, two.manifestHash);
  const three = composePurgeManifest({
    catalog,
    postgres: { entries: [{ id: 3 }] },
    context,
  });
  assert.notEqual(one.manifestHash, three.manifestHash);
  assert.ok(
    compareManifestState(one, three).some(
      (item) => item.code === "MANIFEST_POSTGRES_CHANGED",
    ),
  );
});

test("canonical manifest round-trip does not become stale", () => {
  const expected = compose();
  const roundTripped = JSON.parse(canonicalStringify(expected));

  assert.deepEqual(compareManifestState(expected, roundTripped), []);
});

test("candidate count changes even when entries are identical", () => {
  const expected = compose();
  const current = compose({
    postgres: {
      entries: expected.postgres.entries,
      candidateCount: 1,
    },
  });

  assert.notEqual(expected.manifestHash, current.manifestHash);
  assert.deepEqual(compareManifestState(expected, current), [
    { code: "MANIFEST_POSTGRES_CHANGED" },
    { code: "MANIFEST_HASH_CHANGED" },
  ]);
});

test("same-count preserved content replacement is stale", () => {
  const expected = compose();
  const current = compose({
    postgres: {
      entries: [{ model: "Reference", primaryKeyHash: "content-b" }],
      candidateCount: 0,
    },
  });

  assert.notEqual(expected.postgres.count, undefined);
  assert.equal(expected.postgres.count, current.postgres.count);
  assert.deepEqual(compareManifestState(expected, current), [
    { code: "MANIFEST_POSTGRES_CHANGED" },
    { code: "MANIFEST_HASH_CHANGED" },
  ]);
});

test("catalog, schema, migration, and blockers have stable stale codes", () => {
  const expected = compose();
  const cases = [
    {
      current: compose({
        context: { ...context, catalogHash: "b".repeat(64) },
      }),
      code: "MANIFEST_CATALOGHASH_CHANGED",
    },
    {
      current: compose({
        context: { ...context, schemaFingerprint: "schema-v2" },
      }),
      code: "MANIFEST_SCHEMAFINGERPRINT_CHANGED",
    },
    {
      current: compose({
        context: { ...context, migrationFingerprint: "migration-v2" },
      }),
      code: "MANIFEST_MIGRATIONFINGERPRINT_CHANGED",
    },
    {
      current: composePurgeManifest({
        catalog,
        postgres: {
          entries: expected.postgres.entries,
          candidateCount: expected.postgres.candidateCount,
          blockers: ["OWNERSHIP_UNRESOLVED"],
        },
        minio: { entries: expected.minio.entries },
        temporal: { entries: expected.temporal.entries },
        context,
      }),
      code: "MANIFEST_BLOCKERS_CHANGED",
    },
  ];

  for (const item of cases) {
    const codes = compareManifestState(expected, item.current).map(
      (difference) => difference.code,
    );
    assert.ok(codes.includes(item.code), `${item.code} must be reported`);
    assert.ok(codes.includes("MANIFEST_HASH_CHANGED"));
  }
});
